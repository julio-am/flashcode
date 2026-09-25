import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/session";

export async function GET(_request: Request, ctx: RouteContext<"/api/attempts/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "Not found." }, { status: 404 });
  const user = await currentUser();
  const [attempt] = await db()
    .select({ status: schema.attempts.status, result: schema.attempts.result })
    .from(schema.attempts)
    .where(and(eq(schema.attempts.id, id), eq(schema.attempts.userId, user.id)));
  if (!attempt) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json(attempt);
}
