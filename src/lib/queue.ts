import { PgBoss } from "pg-boss";
import { databaseUrl } from "./db";

export const GRADE_QUEUE = "grade";
export interface GradeJob {
  attemptId: string;
}

const g = globalThis as unknown as { flashBoss?: Promise<PgBoss> };

/** pg-boss keeps its queue tables in the same Postgres, in the "pgboss" schema. */
export function getBoss(): Promise<PgBoss> {
  g.flashBoss ??= (async () => {
    const boss = new PgBoss(databaseUrl());
    boss.on("error", (e) => console.error("[pg-boss]", e));
    await boss.start();
    await boss.createQueue(GRADE_QUEUE);
    return boss;
  })();
  return g.flashBoss;
}

export async function enqueueGrade(job: GradeJob): Promise<void> {
  const boss = await getBoss();
  await boss.send(GRADE_QUEUE, job, { retryLimit: 1, expireInSeconds: 120 });
}
