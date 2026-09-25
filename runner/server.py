"""FlashCode sandbox runner.

A small HTTP service that compiles and runs untrusted C++23 submissions, each
step inside its own nsjail (fresh user, pid, mount, network, ipc and uts
namespaces, rlimits, wall-clock limit, nothing mounted but /usr and the job's
own directory). The whole service is meant to run under gVisor on a machine
with no other secrets, so a jail escape still lands inside gVisor.

  POST /run      {"source": "...", "stdin": "...", "headerSha256": "..."}
                 -> {"compile": {...}, "run": {...}}   (the app's RunOutcome)
  GET  /healthz  -> {"ok": true, "slots": N, "headerSha256": "..."}

Every request except /healthz needs "Authorization: Bearer $RUNNER_TOKEN".
Only the Python standard library is used.
"""

import hashlib
import hmac
import json
import os
import queue
import shutil
import signal
import subprocess
import sys
import threading
import time
import uuid
from typing import NamedTuple, Optional
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
FLASH_DIR = os.environ.get("RUNNER_FLASH_DIR", "/opt/flash")
JOBS_DIR = os.environ.get("RUNNER_JOBS_DIR", "/jobs")
NSJAIL = os.environ.get("RUNNER_NSJAIL", "nsjail")
CXX = os.environ.get("RUNNER_CXX", "/usr/bin/g++-14")

# Keep in step with LIMITS and CXX_STD in src/lib/runner/types.ts.
CXX_STD = "c++23"
COMPILE_SECONDS = 10
RUN_WALL_SECONDS = 3
RUN_CPU_SECONDS = 2
MAX_OUTPUT_BYTES = 64 * 1024
MAX_BODY_BYTES = 512 * 1024
MAX_SOURCE_BYTES = 128 * 1024

FLAGS = [
    f"-std={CXX_STD}",
    "-O0",
    "-pipe",
    "-Wall",
    "-fdiagnostics-plain-output",
    "-fmax-errors=10",
    "-ftemplate-depth=256",
]

# Each concurrent job gets its own slot, and with it its own outside uid, so
# two jobs running at once never own each other's files or processes.
SLOTS = int(os.environ.get("RUNNER_SLOTS", str(os.cpu_count() or 2)))
UID_BASE = 20000
PIDS_CGROUP = "/sys/fs/cgroup/pids/NSJAIL"


def header_sha256() -> str:
    with open(os.path.join(FLASH_DIR, "flash.h"), "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def build_pch() -> None:
    """Precompile flash.h next to itself (Docker build step)."""
    subprocess.run(
        [CXX, *FLAGS, "-x", "c++-header", "flash.h", "-o", "flash.h.gch"],
        cwd=FLASH_DIR,
        check=True,
    )
    os.chmod(os.path.join(FLASH_DIR, "flash.h.gch"), 0o644)


def read_capped(stream, cap: int, on_overflow) -> bytes:
    out = bytearray()
    while True:
        chunk = stream.read(8192)
        if not chunk:
            break
        if len(out) < cap:
            out += chunk[: cap - len(out)]
        if len(out) >= cap:
            on_overflow()
    return bytes(out)


class Jailed(NamedTuple):
    stdout: bytes
    stderr: bytes
    exit_code: Optional[int]
    signal: Optional[str]
    timed_out: bool
    overflow: bool
    wall_ms: int


SIGNALS = {s.value: s.name for s in signal.Signals}


def jail(cfg: str, uid: int, binds: list, cmd: list, stdin: bytes, wall_s: int, cpu_s: int, log_path: str) -> Jailed:
    """Run cmd in a fresh nsjail with the given wall-clock and CPU limits."""
    args = [
        NSJAIL,
        "--config", os.path.join(HERE, cfg),
        "--log", log_path,
        "--time_limit", str(wall_s),
        "--rlimit_cpu", str(cpu_s),
        "-u", f"1000:{uid}:1",
        "-g", f"1000:{uid}:1",
        *binds,
        "--",
        *cmd,
    ]
    started = time.monotonic()
    proc = subprocess.Popen(
        args,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,
    )
    overflow = threading.Event()

    def kill(from_overflow=True):
        if from_overflow:
            overflow.set()
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass

    results = {}
    threads = [
        threading.Thread(target=lambda: results.__setitem__("out", read_capped(proc.stdout, MAX_OUTPUT_BYTES, kill))),
        threading.Thread(target=lambda: results.__setitem__("err", read_capped(proc.stderr, MAX_OUTPUT_BYTES, kill))),
        # wait4 rather than wait: nsjail's rusage includes the jailed program's CPU time.
        threading.Thread(target=lambda: results.__setitem__("wait", os.wait4(proc.pid, 0))),
    ]
    for t in threads:
        t.start()
    try:
        proc.stdin.write(stdin)
    except OSError:
        pass
    finally:
        try:
            proc.stdin.close()
        except OSError:
            pass
    # nsjail enforces wall_s itself; this is the backstop if it hangs.
    threads[2].join(timeout=wall_s + 5)
    if threads[2].is_alive():
        kill(from_overflow=False)
    for t in threads:
        t.join()
    proc.returncode = 0  # reaped by wait4 above; stop Popen from waiting again
    wall_ms = int((time.monotonic() - started) * 1000)
    _, status, usage = results["wait"]
    cpu_ms = int((usage.ru_utime + usage.ru_stime) * 1000)

    # nsjail exits with the program's code, or 128+signal if it was killed.
    exit_code, sig = None, None
    if os.WIFSIGNALED(status):
        sig = SIGNALS.get(os.WTERMSIG(status), "SIGKILL")
    else:
        code = os.WEXITSTATUS(status)
        if code > 128 and (code - 128) in SIGNALS:
            sig = SIGNALS[code - 128]
        else:
            exit_code = code
    try:
        with open(log_path, "r", errors="replace") as f:
            hit_wall = "run time >= time limit" in f.read()
    except OSError:
        hit_wall = False
    # gVisor kills with SIGKILL at the CPU rlimit instead of sending SIGXCPU.
    hit_cpu = sig in ("SIGXCPU", "SIGKILL") and cpu_ms >= cpu_s * 1000 - 100
    return Jailed(
        results.get("out", b""),
        results.get("err", b""),
        exit_code,
        sig or ("SIGKILL" if overflow.is_set() else None),
        hit_wall or hit_cpu or wall_ms >= (wall_s + 5) * 1000,
        overflow.is_set(),
        wall_ms,
    )


def text(b: bytes) -> str:
    return b.decode("utf-8", errors="replace")


def grade(source: str, stdin: str, slot: int) -> dict:
    uid = UID_BASE + slot
    job = os.path.join(JOBS_DIR, uuid.uuid4().hex)
    run_dir = job + ".run"
    os.mkdir(job, 0o700)
    try:
        with open(os.path.join(job, "main.cpp"), "w") as f:
            f.write(source)
        os.chown(job, uid, uid)
        os.chown(os.path.join(job, "main.cpp"), uid, uid)

        c = jail(
            "compile.cfg",
            uid,
            ["--bindmount", f"{job}:/work"],
            [CXX, *FLAGS, "-I", FLASH_DIR, "main.cpp", "-o", "prog"],
            b"",
            COMPILE_SECONDS,
            COMPILE_SECONDS,
            job + ".compile.log",
        )
        compile_output = text(c.stderr or c.stdout)
        if c.timed_out:
            return {"compile": {"ok": False, "output": f"Compilation took longer than {COMPILE_SECONDS}s and was stopped."}}
        if c.overflow:
            return {"compile": {"ok": False, "output": compile_output + "\n[compiler output truncated]"}}
        if c.exit_code != 0:
            if not compile_output and c.signal:
                compile_output = f"The compiler was stopped ({c.signal}); the program may be too large to compile."
            return {"compile": {"ok": False, "output": compile_output}}

        # The run step sees only the binary, read-only and owned by root.
        prog = os.path.join(job, "prog")
        if os.path.islink(prog) or not os.path.isfile(prog):
            return {"compile": {"ok": False, "output": "The compiler did not produce a program."}}
        os.mkdir(run_dir, 0o755)
        shutil.copyfile(prog, os.path.join(run_dir, "prog"))
        os.chmod(os.path.join(run_dir, "prog"), 0o755)

        r = jail(
            "run.cfg",
            uid,
            ["--bindmount_ro", f"{run_dir}:/work"],
            ["/work/prog"],
            stdin.encode(),
            RUN_WALL_SECONDS,
            RUN_CPU_SECONDS,
            job + ".run.log",
        )
        return {
            "compile": {"ok": True, "output": compile_output},
            "run": {
                "stdout": text(r.stdout),
                "stderr": text(r.stderr),
                "exitCode": r.exit_code,
                "signal": r.signal,
                "timedOut": r.timed_out,
                "timeMs": r.wall_ms,
            },
        }
    finally:
        shutil.rmtree(job, ignore_errors=True)
        shutil.rmtree(run_dir, ignore_errors=True)
        for suffix in (".compile.log", ".run.log"):
            try:
                os.unlink(job + suffix)
            except FileNotFoundError:
                pass


class Handler(BaseHTTPRequestHandler):
    server_version = "flashcode-runner"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        sys.stderr.write("[runner] %s %s\n" % (self.address_string(), fmt % args))

    def send_json(self, code: int, body: dict):
        if code != 200:
            # The request body may be unread; don't parse it as the next request.
            self.close_connection = True
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/healthz":
            self.send_json(200, {"ok": True, "slots": SLOTS, "headerSha256": HEADER_SHA})
        else:
            self.send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/run":
            return self.send_json(404, {"error": "not found"})
        auth = self.headers.get("Authorization", "")
        if not hmac.compare_digest(auth.encode(), f"Bearer {TOKEN}".encode()):
            return self.send_json(401, {"error": "unauthorized"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = -1
        if length < 0 or length > MAX_BODY_BYTES:
            return self.send_json(413, {"error": "request too large"})
        try:
            body = json.loads(self.rfile.read(length))
            source, stdin = body["source"], body.get("stdin", "")
            assert isinstance(source, str) and isinstance(stdin, str)
        except Exception:
            return self.send_json(400, {"error": "expected JSON {source, stdin}"})
        if len(source.encode()) > MAX_SOURCE_BYTES or len(stdin.encode()) > MAX_BODY_BYTES:
            return self.send_json(413, {"error": "source or stdin too large"})
        wanted = body.get("headerSha256")
        if wanted and wanted != HEADER_SHA:
            return self.send_json(409, {"error": "flash.h differs between the app and the runner; rebuild the runner image"})
        try:
            slot = FREE_SLOTS.get(timeout=30)
        except queue.Empty:
            return self.send_json(503, {"error": "runner busy"})
        try:
            result = grade(source, stdin, slot)
        except Exception as e:  # noqa: BLE001 - report, don't crash the server
            sys.stderr.write(f"[runner] internal error: {e!r}\n")
            return self.send_json(500, {"error": "internal runner error"})
        finally:
            FREE_SLOTS.put(slot)
        self.send_json(200, result)


def main():
    global TOKEN, HEADER_SHA, FREE_SLOTS
    if "--build-pch" in sys.argv:
        build_pch()
        return
    TOKEN = os.environ.get("RUNNER_TOKEN", "")
    if len(TOKEN) < 16:
        sys.exit("Set RUNNER_TOKEN to a random secret of at least 16 characters.")
    HEADER_SHA = header_sha256()
    FREE_SLOTS = queue.Queue()
    for i in range(SLOTS):
        FREE_SLOTS.put(i)
    os.makedirs(JOBS_DIR, exist_ok=True)
    # nsjail puts each jail in a pids cgroup under this parent (see run.cfg).
    os.makedirs(PIDS_CGROUP, exist_ok=True)
    port = int(os.environ.get("PORT", "8080"))
    httpd = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    httpd.daemon_threads = True
    print(f"[runner] listening on :{port} with {SLOTS} slots, flash.h {HEADER_SHA[:12]}", flush=True)
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    httpd.serve_forever()


TOKEN = ""
HEADER_SHA = ""
FREE_SLOTS: "queue.Queue[int]" = queue.Queue()

if __name__ == "__main__":
    main()
