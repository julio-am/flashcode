// Attacks against a live sandbox runner. Skipped unless FLASH_SANDBOX_URL and
// FLASH_SANDBOX_TOKEN point at one (CI starts one under gVisor):
//   docker run -d --runtime=runsc -p 127.0.0.1:8080:8080 -e RUNNER_TOKEN=... flashcode-runner
//   FLASH_SANDBOX_URL=http://127.0.0.1:8080 FLASH_SANDBOX_TOKEN=... npx vitest run tests/sandbox-isolation.test.ts
import { describe, expect, it } from "vitest";
import { SandboxRunner } from "@/lib/runner/sandbox";
import { LIMITS } from "@/lib/runner/types";

const url = process.env.FLASH_SANDBOX_URL;
const token = process.env.FLASH_SANDBOX_TOKEN;
const runner = url && token ? new SandboxRunner({ url, token }) : null;

async function run(source: string, stdin = "") {
  const out = await runner!.run({ source, stdin });
  expect(out.compile, out.compile.output).toMatchObject({ ok: true });
  return out.run!;
}

/** Each probe prints "name=0" when the attempt was blocked, "name=1" if it worked. */
const PROBES = `
#include <arpa/inet.h>
#include <fcntl.h>
#include <netdb.h>
#include <sys/mount.h>
#include <sys/socket.h>
#include <unistd.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
bool connects(const char* ip, int port) {
  int s = socket(AF_INET, SOCK_STREAM, 0);
  if (s < 0) return false;
  sockaddr_in a{};
  a.sin_family = AF_INET;
  a.sin_port = htons(port);
  inet_pton(AF_INET, ip, &a.sin_addr);
  return connect(s, (sockaddr*)&a, sizeof a) == 0;
}
bool readable(const char* p) { int fd = open(p, O_RDONLY); if (fd >= 0) close(fd); return fd >= 0; }
bool writable(const char* p) { int fd = open(p, O_WRONLY | O_CREAT, 0644); if (fd >= 0) close(fd); return fd >= 0; }
int main() {
  addrinfo* res = nullptr;
  std::printf("dns=%d\\n", getaddrinfo("example.com", "80", nullptr, &res) == 0);
  std::printf("internet=%d\\n", connects("1.1.1.1", 80));
  std::printf("runner_port=%d\\n", connects("127.0.0.1", 8080));
  std::printf("host_gateway=%d\\n", connects("172.17.0.1", 8080));
  std::printf("etc_passwd=%d\\n", readable("/etc/passwd"));
  std::printf("server_py=%d\\n", readable("/opt/runner/server.py"));
  std::printf("jobs_dir=%d\\n", readable("/jobs"));
  std::printf("proc=%d\\n", readable("/proc/1/environ"));
  std::printf("write_work=%d\\n", writable("/work/x"));
  std::printf("write_tmp=%d\\n", writable("/tmp/x"));
  std::printf("write_usr=%d\\n", writable("/usr/lib/x"));
  std::printf("token_env=%d\\n", std::getenv("RUNNER_TOKEN") != nullptr);
  std::printf("setuid0=%d\\n", setuid(0) == 0 && getuid() == 0);
  std::printf("mount=%d\\n", mount("none", "/work", "tmpfs", 0, nullptr) == 0);
}
`;

describe.skipIf(!runner)("sandbox runner isolation", () => {
  it("blocks the network, the filesystem, the runner's secrets and privilege changes", async () => {
    const r = await run(PROBES);
    const got = Object.fromEntries(r.stdout.trim().split("\n").map((l) => l.split("=")));
    expect(got).toEqual({
      dns: "0",
      internet: "0",
      runner_port: "0",
      host_gateway: "0",
      etc_passwd: "0",
      server_py: "0",
      jobs_dir: "0",
      proc: "0",
      write_work: "0",
      write_tmp: "0",
      write_usr: "0",
      token_env: "0",
      setuid0: "0",
      mount: "0",
    });
  });

  it("stops an infinite loop on CPU time", async () => {
    const r = await run("int main() { for (volatile long i = 0;; i = i + 1) {} }");
    expect(r.timedOut).toBe(true);
    expect(r.timeMs).toBeLessThan((LIMITS.runWallSeconds + 2) * 1000);
  });

  it("stops a program that sleeps past the wall-clock limit", async () => {
    const r = await run("#include <unistd.h>\nint main() { sleep(30); }");
    expect(r.timedOut).toBe(true);
    expect(r.timeMs).toBeLessThan((LIMITS.runWallSeconds + 2) * 1000);
  });

  it("allows threads but not new processes", async () => {
    const r = await run(`
      #include <cstdio>
      #include <thread>
      #include <unistd.h>
      int main() {
        std::thread t([] { std::puts("thread"); });
        t.join();
        std::printf("fork=%d\\n", fork() >= 0);
      }`);
    expect(r.stdout).toBe("thread\nfork=0\n");
  });

  it("caps the number of threads", async () => {
    const r = await run(`
      #include <cstdio>
      #include <pthread.h>
      #include <unistd.h>
      int main() {
        int n = 0;
        pthread_t t;
        while (n < 1000 && pthread_create(&t, nullptr, [](void*) -> void* { pause(); return nullptr; }, nullptr) == 0) n++;
        std::printf("%d\\n", n);
        _exit(0);
      }`);
    expect(Number(r.stdout)).toBeLessThan(16);
  });

  it("contains a fork bomb, and the runner keeps serving", async () => {
    const bomb = run("#include <unistd.h>\nint main() { for (;;) fork(); }");
    const normal = run('#include <cstdio>\nint main() { std::puts("still here"); }');
    const [b, n] = await Promise.all([bomb, normal]);
    expect(b.timedOut).toBe(true);
    expect(n).toMatchObject({ stdout: "still here\n", exitCode: 0 });
  });

  it("caps memory", async () => {
    const r = await run(`
      #include <cstdio>
      #include <cstring>
      int main() {
        size_t n = size_t(1) << 30;
        char* p = new char[n];
        std::memset(p, 1, n);
        std::puts("allocated");
      }`);
    expect(r.stdout).not.toContain("allocated");
    expect(r.stderr).toContain("bad_alloc");
  });

  it("caps output", async () => {
    const r = await run('#include <cstdio>\nint main() { for (;;) std::fputs("spam spam spam spam\\n", stdout); }');
    expect(r.stdout.length).toBeLessThanOrEqual(LIMITS.maxOutputBytes);
    expect(r.exitCode).not.toBe(0);
  });

  it("confines kill(-1) to the jail", async () => {
    const r = await run("#include <csignal>\nint main() { kill(-1, SIGKILL); return 3; }");
    expect(r.exitCode === 3 || r.signal === "SIGKILL").toBe(true);
    const after = await run('#include <cstdio>\nint main() { std::puts("ok"); }');
    expect(after.stdout).toBe("ok\n");
  });

  it("does not let the compiler read files or hang on devices", async () => {
    const passwd = await runner!.run({ source: '#include "/etc/passwd"\nint main() {}', stdin: "" });
    expect(passwd.compile.ok).toBe(false);
    expect(passwd.compile.output).toMatch(/No such file/);
    const random = await runner!.run({ source: '#include "/dev/random"\nint main() {}', stdin: "" });
    expect(random.compile.ok).toBe(false);
  });

  it("stops a compile that runs too long", async () => {
    const started = Date.now();
    const out = await runner!.run({
      source: `
        constexpr long spin(long n) { long s = 0; for (long i = 0; i < n; ++i) s += i % 7; return s; }
        static_assert(spin(1L << 40) != 1);
        int main() {}`,
      stdin: "",
    });
    expect(out.compile.ok).toBe(false);
    expect(Date.now() - started).toBeLessThan((LIMITS.compileSeconds + 5) * 1000);
  });

  it("rejects requests without the token, and a mismatched flash.h", async () => {
    const noAuth = await fetch(`${url}/run`, { method: "POST", body: JSON.stringify({ source: "int main(){}" }) });
    expect(noAuth.status).toBe(401);
    const stale = await fetch(`${url}/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ source: "int main(){}", stdin: "", headerSha256: "0".repeat(64) }),
    });
    expect(stale.status).toBe(409);
  });
});
