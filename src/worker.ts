// The grading worker: pulls attempts off the queue, runs them through the
// configured Runner, and writes results back. Run it next to the web app:
//   npm run worker
import { gradeAttempt } from "./lib/grade-attempt";
import { GRADE_QUEUE, getBoss, type GradeJob } from "./lib/queue";
import { getRunner } from "./lib/runner";

async function main() {
  const runner = getRunner();
  const boss = await getBoss();
  const concurrency = Number(process.env.FLASH_WORKER_CONCURRENCY ?? 2);
  await boss.work<GradeJob>(GRADE_QUEUE, { localConcurrency: concurrency, pollingIntervalSeconds: 0.5 }, async (jobs) => {
    for (const job of jobs) await gradeAttempt(job.data.attemptId);
  });
  console.log(`[worker] grading with the ${runner.name} runner, concurrency ${concurrency}`);

  const stop = async () => {
    await boss.stop({ graceful: true, timeout: 10_000 });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
