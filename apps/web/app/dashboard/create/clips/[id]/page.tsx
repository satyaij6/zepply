import { JobView } from "@/components/create/clips/JobView";

export default async function ClipJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobView id={id} />;
}
