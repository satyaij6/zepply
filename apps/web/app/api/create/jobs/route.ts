import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireCreator } from "@/lib/clip-access";
import { CAPTION_POSITIONS, CLIP_COUNT, CLIP_LANGUAGES, CLIP_LAYOUTS, CLIP_STYLES, MAX_ACTIVE_JOBS, isYouTubeUrl } from "@/lib/clip-engine";
import { sourceExists } from "@/lib/clip-storage";
import { EDIT_TEMPLATES, isKeyword, templateOf } from "@/lib/clip-templates";

const values = <T extends { value: string }>(list: readonly T[]) => list.map((o) => o.value) as [T["value"], ...T["value"][]];

const body = z.object({
  title: z.string().trim().max(200).optional(),
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("UPLOAD"), path: z.string().min(1) }),
    z.object({
      kind: z.literal("YOUTUBE"),
      url: z.string().refine(isYouTubeUrl, "Paste a youtube.com or youtu.be link"),
      ownsContent: z.literal(true, { error: "Confirm you own this video or have permission to use it" }),
    }),
  ]),
  language: z.enum(values(CLIP_LANGUAGES)),
  clipCount: z.number().int().min(CLIP_COUNT.min).max(CLIP_COUNT.max),
  /** The edit template; the options below override what it would choose */
  template: z.enum(values(EDIT_TEMPLATES)).default("simple"),
  /** Caption style, or "none" for no captions. Omitted: the template's choice. */
  style: z.union([z.enum(values(CLIP_STYLES)), z.literal("none")]).optional(),
  captionPos: z.enum(CAPTION_POSITIONS),
  layout: z.enum(values(CLIP_LAYOUTS)).default("auto"),
  effects: z.boolean().optional(),
  broll: z.boolean().optional(),
  /** "Comment for link": the keyword people comment, and what they get */
  cta: z
    .object({
      keyword: z.string().trim().refine(isKeyword, "The keyword is one word, letters or numbers, 2-16 long"),
      link: z.string().trim().url("Paste the full link, starting with https://").optional().or(z.literal("")),
      message: z.string().trim().max(600).optional(),
    })
    .optional(),
});

// GET — The user's clip jobs, newest first
export async function GET() {
  const { userId, error } = await requireCreator();
  if (error) return error;

  const jobs = await prisma.clipJob.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, title: true, sourceKind: true, status: true, stage: true, progress: true, error: true,
      language: true, clipCount: true, template: true, createdAt: true, finishedAt: true,
      _count: { select: { clips: true } },
    },
  });
  return NextResponse.json({ jobs });
}

// POST — Queue a long video for the clip engine
export async function POST(request: NextRequest) {
  const { userId, error } = await requireCreator();
  if (error) return error;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { title, source, template: templateValue, style, effects, broll, cta, ...options } = parsed.data;
  const template = templateOf(templateValue);
  if (template.cta && !cta?.keyword) {
    return NextResponse.json({ error: "Add the keyword people will comment, like CLAUDE or LINK." }, { status: 400 });
  }

  if (source.kind === "UPLOAD") {
    // Only files this user uploaded, and only once the upload actually finished
    if (!source.path.startsWith(`${userId}/`) || !(await sourceExists(source.path))) {
      return NextResponse.json({ error: "That upload wasn't found. Try uploading again." }, { status: 400 });
    }
  }

  const active = await prisma.clipJob.count({ where: { userId, status: { in: ["QUEUED", "RUNNING"] } } });
  if (active >= MAX_ACTIVE_JOBS) {
    return NextResponse.json({ error: `You can have ${MAX_ACTIVE_JOBS} videos processing at once. Wait for one to finish.` }, { status: 429 });
  }

  const keyword = template.cta ? cta!.keyword.toUpperCase() : null;
  const link = template.cta && cta?.link ? cta.link : null;
  const name = title || (source.kind === "UPLOAD" ? source.path.split("/").pop() ?? null : null);

  // "Comment for link": the reel's ending tells people to comment the keyword, so the keyword must
  // actually send something. Created up front, on the user's Instagram account, if one is connected.
  let triggerId: string | null = null;
  let trigger: "created" | "no-instagram" | "no-link" | null = null;
  if (keyword) {
    const account = link
      ? await prisma.instagramAccount.findFirst({ where: { userId, isActive: true }, select: { id: true } })
      : null;
    if (!link) trigger = "no-link";
    else if (!account) trigger = "no-instagram";
    else {
      const created = await prisma.trigger.create({
        data: {
          igAccountId: account.id,
          name: `Reel: ${name ?? keyword}`.slice(0, 120),
          type: "COMMENT",
          keywords: [keyword.toLowerCase()],
          replyMessage: cta?.message || "Here's the link you asked for:",
          deliverLink: link,
          postScope: "next",
        },
        select: { id: true },
      });
      triggerId = created.id;
      trigger = "created";
    }
  }

  const job = await prisma.clipJob.create({
    data: {
      userId,
      title: name,
      sourceKind: source.kind,
      sourcePath: source.kind === "UPLOAD" ? source.path : null,
      sourceUrl: source.kind === "YOUTUBE" ? source.url : null,
      ownsContent: source.kind === "YOUTUBE",
      ...options,
      template: template.value,
      style: style ?? template.caption,
      effects: effects ?? template.effects,
      broll: broll ?? template.broll,
      brollLook: template.look,
      cardLayout: template.card,
      ctaKeyword: keyword,
      ctaLink: link,
      triggerId,
    },
    select: { id: true },
  });
  return NextResponse.json({ ...job, trigger }, { status: 201 });
}
