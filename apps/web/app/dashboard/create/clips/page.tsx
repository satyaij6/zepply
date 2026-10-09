import { redirect } from "next/navigation";

// The clip studio now lives on Create itself; keep old links (and ?template=) working.
export default async function ClipsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of [value ?? []].flat()) query.append(key, v);
  }
  const qs = query.toString();
  redirect(`/dashboard/create${qs ? `?${qs}` : ""}`);
}
