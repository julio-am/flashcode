import { Drill } from "@/components/Drill";

export default async function DrillPage({ searchParams }: PageProps<"/drill">) {
  const { category } = await searchParams;
  return <Drill key={String(category ?? "all")} category={typeof category === "string" ? category : undefined} />;
}
