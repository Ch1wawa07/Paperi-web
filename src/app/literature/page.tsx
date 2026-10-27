import { redirect } from "next/navigation";
import { Literature } from "@/components/literature";
export const metadata = { title: "文献工作台" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    query?: string | string[];
    project?: string;
    concepts?: string;
    mode?: string;
    history?: string;
  }>;
}) {
  const { query, project, concepts, mode, history } = await searchParams;
  if (mode === "context") {
    const params = new URLSearchParams();
    if (history === "1") params.set("history", "1");
    if (typeof project === "string") params.set("project", project);
    redirect(`/research${params.size ? `?${params}` : ""}`);
  }
  return (
    <Literature
      showHistory={history === "1"}
      initialMode={
        mode && ["library", "import", "reading", "context"].includes(mode)
          ? mode
          : "start"
      }
      requestProject={project}
      fromConcepts={concepts === "1"}
      initialQuery={
        typeof query === "string" && query.length <= 200 ? query : undefined
      }
    />
  );
}
