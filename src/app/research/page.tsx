import { ResearchJourney } from "@/components/research-journey";
export const metadata = { title: "研究脉络" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; project?: string; history?: string }>;
}) {
  const { stage, project, history } = await searchParams;
  return (
    <ResearchJourney
      initialStage={stage}
      requestProject={project}
      showHistory={history === "1"}
    />
  );
}
