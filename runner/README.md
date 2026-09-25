# Sandbox runner

The service that compiles and runs submitted C++ for production. The app's
`sandbox` runner (`src/lib/runner/sandbox.ts`) sends it `{source, stdin}` over
HTTP and gets back the same `RunOutcome` every runner returns.

Three layers stand between a submission and anything that matters:

1. **nsjail, per step.** g++ and the compiled program each run in a fresh jail:
   new user, pid, mount, network, IPC and UTS namespaces; a filesystem of
   read-only `/usr` plus the job's own directory (the run step gets only the
   binary, read-only); an empty network namespace with no interfaces at all;
   limits on wall time, CPU time, address space (256 MiB per process when
   running, 1.5 GiB when compiling), threads (a pids cgroup), open files and
   output size (64 KiB). A seccomp filter stops the program from starting new
   processes; threads still work. Each concurrent job maps to its own outside
   uid.
2. **gVisor, around the whole service.** The container runs under `runsc`, so
   a kernel exploit that escapes nsjail lands in gVisor's user-space kernel,
   not the host's.
3. **A machine with nothing on it.** Run it on its own VM with no secrets, no
   database access, and outbound traffic blocked. Only the app talks to it,
   with a shared token.

## Run it

Default hosting: any Linux VM (x86-64, 2+ vCPU, 4 GB RAM) with Docker. Nothing
here provisions one for you.

```sh
# 1. gVisor (https://gvisor.dev/docs/user_guide/install/)
curl -fsSL https://gvisor.dev/archive.key | sudo gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" \
  | sudo tee /etc/apt/sources.list.d/gvisor.list
sudo apt-get update && sudo apt-get install -y runsc
sudo runsc install && sudo systemctl restart docker

# 2. The image, from the repo root (it bakes in grader/flash.h)
docker build -f runner/Dockerfile -t flashcode-runner .

# 3. The service. Publish the port on the private interface only.
docker run -d --name flashcode-runner --restart unless-stopped \
  --runtime=runsc --memory 4g \
  -p 10.0.0.5:8080:8080 \
  -e RUNNER_TOKEN="$(openssl rand -hex 32)" \
  flashcode-runner
```

Then block everything outbound from the VM and allow inbound 8080 only from
the app (a cloud firewall or `ufw default deny outgoing`). Jobs already have no
network; this keeps the service itself from being useful to anyone who gets in.

Point the app's web and worker processes at it:

```sh
FLASH_RUNNER=sandbox                     # the default whenever FLASH_SANDBOX_URL is set
FLASH_SANDBOX_URL=http://10.0.0.5:8080
FLASH_SANDBOX_TOKEN=<the RUNNER_TOKEN above>
```

The token travels in plain HTTP, so keep the link on a private network or put
TLS in front of it.

**Rebuild the image whenever `grader/flash.h` changes.** The app sends the
header's hash with every request, and the runner answers 409 on a mismatch
rather than grading against a stale header.

| Variable | Default | |
| --- | --- | --- |
| `RUNNER_TOKEN` | required | Shared secret, 16+ characters |
| `RUNNER_SLOTS` | CPU count | Jobs that run at once; the rest wait up to 30 s, then get 503 |
| `PORT` | 8080 | |

`GET /healthz` needs no token and reports the slot count and the baked-in
header's hash.

## Tested

`tests/sandbox-isolation.test.ts` attacks a live runner, and CI runs it under
gVisor on every PR, along with `npm run verify` (every reference solution
passes, every wrong answer fails) through the sandbox. It checks that a
submission cannot resolve DNS, reach the internet, the runner's own port or
the Docker host; cannot read `/etc/passwd`, the server's code, other jobs or
`/proc`; cannot write anywhere; cannot see the token, become root or mount;
and that infinite loops, sleeps, fork bombs, thread bombs, 1 GiB allocations, output floods,
`kill(-1)`, `#include "/dev/random"` and compile-time `constexpr` loops are all
stopped while the runner keeps serving.

## gVisor quirks this setup works around

- nsjail's tagged releases need libnl to set up networking, and gVisor's
  netlink can't serve it; the image builds a later nsjail commit without
  libnl and leaves the network namespace empty.
- gVisor rejects `SECBIT_NO_SETUID_FIXUP` and any change to
  `RLIMIT_MSGQUEUE`; `nsjail-gvisor.patch` falls back to `SECBIT_KEEP_CAPS`
  and skips the message-queue limit.
- gVisor rejects `CLONE_NEWCGROUP`, ignores `RLIMIT_NPROC` and doesn't enforce
  memory cgroups. Process counts use a pids cgroup, memory uses `RLIMIT_AS`,
  and the container's `--memory` is the backstop.
- Don't pass `--pids-limit` to `docker run`: when gVisor hits it, the whole
  sandbox crashes. The same goes for a fork bomb churning through address
  spaces (each costs gVisor a host process), which is why the run jail
  blocks `fork` with seccomp.
- It applies `RLIMIT_FSIZE` to pipes, and kills with `SIGKILL` (not
  `SIGXCPU`) at the CPU limit; the server reads the jail's CPU time to report
  that as a timeout.

## Developing

`server.py` is standard-library Python. To iterate without rebuilding, mount
this directory over the image's copy:

```sh
docker run --rm --runtime=runsc -p 127.0.0.1:8080:8080 -v "$PWD/runner:/opt/runner:ro" \
  -e RUNNER_TOKEN=dev-token-0123456789 flashcode-runner
FLASH_SANDBOX_URL=http://127.0.0.1:8080 FLASH_SANDBOX_TOKEN=dev-token-0123456789 \
  npx vitest run tests/sandbox-isolation.test.ts
```

The limits in `server.py` mirror `LIMITS` in `src/lib/runner/types.ts`;
change both together.
