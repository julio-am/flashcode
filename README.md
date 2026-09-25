# FlashCode

Quick active-recall drills for C++. You get a short prompt ("append `a` to the end of `b`", "declare a min-heap of ints", "write inorder traversal"), type the answer from memory, and a test harness grades it. Spaced repetition (FSRS) brings misses back sooner and lets easy ones fade out.

v1 ships 24 problems in three categories: vector operations, initialization syntax, and algorithms.

## Run it locally

Needs Node 22.12+, Postgres 13+, and `g++` (GCC 10+).

```bash
npm install
cp .env.example .env.local        # then set DATABASE_URL and SESSION_SECRET
npm run db:migrate                # creates the app tables
npm run dev                       # Next.js on :3000 plus the grading worker
```

`npm run dev` starts two processes: the web app and the worker that grades submissions. With `FLASH_RUNNER=local` the worker compiles with your own `g++`.

> **The local runner is not a sandbox.** Submitted code runs as your user with only rlimits and a timeout. It is for development, and it refuses to start when `NODE_ENV=production`.

## How grading works

```
browser ──POST /api/attempts──▶ Next.js ──pg-boss job──▶ worker ──Runner──▶ g++ / Judge0
   ▲                                                        │
   └──────── polls /api/attempts/:id ◀── result in Postgres ◀┘
```

1. The web app validates the submission, rate-limits it (10 per minute, 2 in flight per user), stores an `attempts` row, and queues a job. It never compiles anything.
2. The worker splices the answer into the problem's `harness.cpp` at `// @USER_CODE`, with `#line` directives so compiler errors point at `your_code.cpp:2`, not at the harness.
3. The Runner compiles and runs it. The program reads a random per-job token from stdin and prints one `@@FLASH <token> {...}` line per check, then a done line. Output without the token (a user printing a fake pass) is ignored, and a missing done line counts as a crash.
4. The first graded result for each time a problem is shown sets its FSRS rating: pass is Good (Hard if it took over 3 minutes), fail or peeking at the solution is Again. Compile errors don't count, so a typo can be fixed and resubmitted.

## Runners

All execution goes through the `Runner` interface in `src/lib/runner/types.ts`. Pick one with `FLASH_RUNNER`:

| Runner | Use | Config |
| --- | --- | --- |
| `local` | Development and CI (reference solutions only) | `FLASH_CXX_STD` (default `c++20`) |
| `judge0` | Hosted prototype (RapidAPI Judge0 CE) or a self-hosted Judge0 | `JUDGE0_URL`, `JUDGE0_API_KEY`, `JUDGE0_LANGUAGE_ID`, `JUDGE0_COMPILER_OPTIONS` |

For Judge0, `flash.h` is pasted into the source, since Judge0 takes a single file. Language 54 (GCC 9.2) is the default on Judge0 CE; harnesses stay C++17-compatible so they work there. If your instance lists a newer GCC under `GET /languages`, set its id and `-std=c++20`.

The planned launch runner (g++ in nsjail inside gVisor on a separate no-network VM, with the precompiled header) is a new class implementing the same interface.

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
src/lib/runner/           Runner interface, local g++, Judge0
src/lib/scheduler.ts      FSRS ratings and "what comes next"
src/lib/grade-attempt.ts  worker-side grading of one attempt
src/worker.ts             pg-boss consumer
src/app/                  pages and API routes
```

## Not done yet

- Sign-in. Users are anonymous guests keyed by a signed cookie; Auth.js can attach to the `users` table.
- The self-hosted sandbox runner.
- Deployment config.
