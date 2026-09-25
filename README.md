# FlashCode

Quick active-recall drills for C++. You get a short prompt ("append `a` to the end of `b`", "declare a min-heap of ints", "write inorder traversal"), type the answer from memory, and a test harness grades it. Spaced repetition (FSRS) brings misses back sooner and lets easy ones fade out.

v1 ships 24 problems in three categories: vector operations, initialization syntax, and algorithms.

## Run it locally

Needs Node 22.12+, Postgres 13+, and `g++` 13+ (everything compiles as C++23).

```bash
npm install
cp .env.example .env.local        # then set DATABASE_URL, SESSION_SECRET and BETTER_AUTH_SECRET
npm run db:migrate                # creates the app tables
npm run dev                       # Next.js on :3000 plus the grading worker
```

`npm run dev` starts two processes: the web app and the worker that grades submissions. With `FLASH_RUNNER=local` the worker compiles with your own `g++`.

> **The local runner is not a sandbox.** Submitted code runs as your user with only rlimits and a timeout. It is for development, and it refuses to start when `NODE_ENV=production`.

## Sign-in

Visitors practise as anonymous guests (a signed `fc_uid` cookie and a `users` row with no email). Signing in with GitHub or Google goes through [Better Auth](https://www.better-auth.com/) (`src/lib/auth.ts`, mounted at `/api/auth/*`), which keeps its users, sessions and linked accounts in the same Postgres. The first request after signing in moves the guest's attempts and review schedule onto the account and deletes the guest (`src/lib/merge-guest.ts`); where both have a schedule for the same problem, the more recent review wins. The same email from both providers is one account.

Each provider needs an OAuth app, and its button only shows once its two variables are set:

| Provider | Register at | Callback URL | Variables |
| --- | --- | --- | --- |
| GitHub | GitHub > Settings > Developer settings > OAuth Apps | `<BETTER_AUTH_URL>/api/auth/callback/github` | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| Google | Google Cloud Console > APIs & Services > Credentials > OAuth client ID (Web application) | `<BETTER_AUTH_URL>/api/auth/callback/google` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |

For local development use `http://localhost:3000` as `BETTER_AUTH_URL`. GitHub OAuth apps take one callback URL each, so register a second app for the deployed site.

## How grading works

```
browser ──POST /api/attempts──▶ Next.js ──pg-boss job──▶ worker ──Runner──▶ g++ / Judge0
   ▲                                                        │
   └──────── polls /api/attempts/:id ◀── result in Postgres ◀┘
```

1. The web app validates the submission, rate-limits it (10 per minute, 2 in flight per user), stores an `attempts` row, and queues a job. It never compiles anything.
2. The worker splices the answer into the problem's `harness.cpp` at `// @USER_CODE`, with `#line` directives so compiler errors point at `your_code.cpp:2`, not at the harness.
3. The Runner compiles and runs it. The program reads a random per-job token from stdin and prints `@@FLASH <token> {...}` lines as each numbered test case begins, checks a value, and ends, then a done line. What the program prints between those lines becomes that test case's stdout. Output without the token (a user printing a fake pass) is ignored, and a missing done line counts as a crash.
4. The first graded result for each time a problem is shown sets its FSRS rating: pass is Good (Hard if it took over 3 minutes), fail or peeking at the solution is Again. Compile errors don't count, so a typo can be fixed and resubmitted.

## Runners

All execution goes through the `Runner` interface in `src/lib/runner/types.ts`. Pick one with `FLASH_RUNNER`:

| Runner | Use | Config |
| --- | --- | --- |
| `sandbox` | Production: g++ in nsjail inside gVisor, on its own machine ([runner/](runner/README.md)) | `FLASH_SANDBOX_URL`, `FLASH_SANDBOX_TOKEN` |
| `local` | Development and CI (reference solutions only) | `CXX` to pick the compiler (default `g++`) |
| `judge0` | Hosted prototype (RapidAPI Judge0 CE) or a self-hosted Judge0 | `JUDGE0_URL`, `JUDGE0_API_KEY`, `JUDGE0_LANGUAGE_ID` |

v1 is scoped to C++23: every runner compiles with `-std=c++23` (`CXX_STD` in `src/lib/runner/types.ts`). For Judge0, `flash.h` is pasted into the source, since Judge0 takes a single file, and `JUDGE0_LANGUAGE_ID` has no default: it must name a GCC 11+ language from your instance's `GET /languages`. The classic Judge0 CE language list tops out at GCC 9, which can't compile C++23, so check before relying on it.

With `FLASH_SANDBOX_URL` set, `sandbox` is the default. In production the `local` runner refuses to start, since it is not a sandbox. [runner/README.md](runner/README.md) covers building and hosting the sandbox runner.

## Deploying

[deploy/README.md](deploy/README.md) is the runbook: one Linux server running Caddy, the web app, the worker, Postgres and the sandbox runner (under gVisor) with Docker Compose, deployed from `main` by the Deploy workflow.

## Adding problems

See [problems/README.md](problems/README.md). Every problem has a reference solution that must pass and at least one wrong answer that must fail; `npm run verify` checks all of them.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Web app and worker together |
| `npm run worker` | Worker only |
| `npm run verify` | Grade every reference and wrong answer (`-- vectors/` to filter) |
| `npm test` | Unit tests (includes a few real compiles with the local runner) |
| `npm run db:generate` / `db:migrate` | Create / apply migrations after editing `src/lib/db/schema.ts` |

## Layout

```
problems/                 prompts, harnesses, reference and wrong answers
grader/flash.h            CHECK / CHECK_EQ / FAIL / FLASH_DONE
src/lib/grader/           assemble source, validate input, parse results
src/lib/runner/           Runner interface, sandbox client, local g++, Judge0
src/lib/scheduler.ts      FSRS ratings and "what comes next"
src/lib/grade-attempt.ts  worker-side grading of one attempt
src/worker.ts             pg-boss consumer
src/app/                  pages and API routes
runner/                   the sandbox runner service (Docker image, nsjail configs)
deploy/                   production stack (Compose, Caddy), server setup, runbook
```
