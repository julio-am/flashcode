import { toPublic } from "@/lib/problems";
import { pickNext } from "@/lib/scheduler";
import { currentUser } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = await currentUser();
  const pick = await pickNext(user.id, url.searchParams.get("category") || undefined, url.searchParams.get("exclude") || undefined);
  if (!pick) return Response.json({ error: "No problems in that category." }, { status: 404 });
  return Response.json({ problem: toPublic(pick.problem), reason: pick.reason, stats: pick.stats });
}
