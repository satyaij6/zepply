import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireCreator } from "@/lib/clip-access";
import { CLIP_STYLES, MAX_ACTIVE_JOBS } from "@/lib/clip-engine";
import { EDIT_TEMPLATES, templateOf } from "@/lib/clip-templates";

const values = <T extends { value: string }>(list: readonly T[]) => list.map((o) => o.value) as [T["value"], ...T["value"][]];

const body = z.object({
  template: z.enum(values(EDIT_TEMPLATES)),
  style: z.union([z.enum(values(CLIP_STYLES)), z.literal("none")]).optional(),
});

// POST — Re-render one finished clip in another template, reusing its job's analysis
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId, error } = await requireCreator();
  if (error) return error;
  const { id } = await params;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const template = templateOf(parsed.data.template);
  if (template.cta) {
    return NextResponse.json({ error: "Comment for link needs a keyword and link. Start a new video with that template instead." }, { status: 400 });
  }

  const clip = await prisma.clip.findFirst({
    where: { id, job: { userId } },
    select: {
      rank: true,
      title: true,
      job: {
        select: {
          id: true, title: true, status: true, bundlePath: true, sourceKind: true, sourcePath: true, sourceUrl: true,
          ownsContent: true, language: true, captionPos: true, layout: true, parentJobId: true,
        },
      },
    },
  });
  if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // A restyle of a restyle goes back to the original analysis
  const origin = clip.job.parentJobId
    ? await prisma.clipJob.findFirst({ where: { id: clip.job.parentJobId, userId }, select: { id: true, bundlePath: true } })
    : { id: clip.job.id, bundlePath: clip.job.bundlePath };
  if (!origin?.bundlePath) {
    return NextResponse.json({ error: "This video was made before restyling existed. Make it again to try other styles." }, { status: 409 });
  }

  const active = await prisma.clipJob.count({ where: { userId, status: { in: ["QUEUED", "RUNNING"] } } });
  if (active >= MAX_ACTIVE_JOBS) {
    return NextResponse.json({ error: `You can have ${MAX_ACTIVE_JOBS} videos processing at once. Wait for one to finish.` }, { status: 429 });
  }

  const job = await prisma.clipJob.create({
    data: {
      userId,
      title: `${clip.title} · ${template.label}`.slice(0, 200),
      sourceKind: clip.job.sourceKind,
      sourcePath: clip.job.sourcePath,
      sourceUrl: clip.job.sourceUrl,
      ownsContent: clip.job.ownsContent,
      language: clip.job.language,
      captionPos: clip.job.captionPos,
      layout: clip.job.layout,
      clipCount: 1,
      template: template.value,
      style: parsed.data.style ?? template.caption,
      effects: template.effects,
      broll: template.broll,
      brollLook: template.look,
      cardLayout: template.card,
      parentJobId: origin.id,
      onlyRank: clip.rank,
    },
    select: { id: true },
  });
  return NextResponse.json(job, { status: 201 });
}
