# Zepply — Wave 0 Task Plan

**Create. Reply. Multiply.**

| | |
|---|---|
| **Version** | 1.0 · 4 October 2026 |
| **Goal of Wave 0** | Get everything ready to build Wave 1: one repository, working environments, the base layer (login, workspaces, database, API, jobs), and every long-wait approval submitted. |
| **Duration** | About 2 weeks |
| **Exit criteria** | Staging is live · a user can sign up and get a workspace on web and mobile · one Instagram post can be published from staging · all Meta and app-store applications submitted |
| **Full spec** | `Zepply_Core_Product_Spec_v1.pdf` (same folder). Section numbers below refer to it. |

---

## How to use this file

- Tick `[x]` as tasks finish. Keep this file in the repository root as `docs/WAVE0.md` once the repo exists.
- **Part A** is for the founder (business tasks that take weeks of waiting, so start them on day 1).
- **Part B** is for the developer (tickets `T-01` to `T-15`, in build order).
- **Part C** lists the decisions to close in the first meeting.
- **Part D** is the Wave 1 build order that comes next.

---

## Timeline at a glance

| Week | Founder | Developer |
|---|---|---|
| **Week 1** | F1 walkthrough · F2 Meta verification · F3 app-store accounts · F4 name and tagline checks | T-01 to T-06: repository, apps, packages, clip worker, environments |
| **Week 2** | F5 pilot users · F6 legal pages · F7 AI vendor shortlist | T-07 to T-15: login, workspaces, database, API, jobs, credits, Meta test flow |

---

## Part A — Founder tasks

### F1 · Walk the developer through the spec
- [ ] Share `Zepply_Core_Product_Spec_v1.pdf` and this file
- [ ] 1–2 hour walkthrough: Sections 2–5 (product, rules, structure, architecture)
- [ ] Close the open decisions in **Part C** and write the answers here

**Done when:** the developer can explain the shared core vs. business layer and the web-primary / mobile-companion split in their own words.

### F2 · Meta approvals (longest wait, so start first)
- [ ] **Meta Business Verification** for the company (needs incorporation certificate, GST/PAN, business address, matching website and domain)
- [ ] Create the **Meta developer app** (with the developer; add them as an admin)
- [ ] Start **WhatsApp Business Platform** onboarding and display-name approval
- [ ] Plan the **App Review** submission (Instagram messaging, comments, content publishing). It needs screen recordings of working features, which come from ticket **T-13**
- [ ] Later: **Marketing API Advanced Access** (needed for ads in Wave 3)

**Blocks:** auto-posting (M6), DM automation (M7), WhatsApp (B2), ads (B4).

### F3 · App-store accounts
- [ ] Get a **D-U-N-S number** for the company (free; can take 1–2 weeks; Apple needs it for an organisation account)
- [ ] **Apple Developer Program**, organisation account ($99/year)
- [ ] **Google Play Console**, organisation account ($25 one-time; complete identity verification)
- [ ] Invite the developer to both

**Blocks:** TestFlight and Play internal testing builds of the mobile app.

### F4 · Name, tagline and handles
- [ ] Trademark search for **"Zepply"** and **"Create. Reply. Multiply."** (IP India public search + Google)
- [ ] Secure the domain(s) and the Instagram, YouTube, X and LinkedIn handles
- [ ] Note: never use "24/7" wording in Zepply copy (it is a competitor's headline)

### F5 · Pilot users for Wave 1
- [ ] Recruit **10–20 pilot users**: about half creators (podcasters, coaches, influencers) and half businesses
- [ ] Prefer Telugu/Hindi speakers. Language quality is our edge and needs real testers
- [ ] Agree on what they get (free months) and what we get (weekly feedback, a case study)

### F6 · Legal pages (do them properly, unlike the competitor's copied template)
- [ ] **Terms of Service**: customer owns inputs and outputs; training on customer data is opt-in; auto-renewal and cancellation; free redo for AI mistakes; governing law India
- [ ] **Privacy Policy** aligned with the DPDP Act 2023; Meta data-deletion callback URL
- [ ] **Refund and cancellation policy**
- [ ] Have a lawyer review all three before launch

### F7 · AI vendor shortlist (input for decision OD3)
- [ ] Shortlist 2–3 vendors each for image generation, video generation and voiceover (Telugu/Hindi/English)
- [ ] Collect 10 real product photos and 5 real business briefs to use as the test set for the bake-off

---

## Part B — Developer tickets

Each ticket lists: **goal → tasks → done when → depends on → rough estimate**.

### T-01 · Create the monorepo
**Goal:** one repository for web, mobile, shared code and workers (spec §5.4).
- [x] Repo `zepply` restructured into a monorepo with **Turborepo + pnpm 10** (branch `chore/monorepo-setup`)
- [ ] Layout:
  ```
  zepply/
  ├─ apps/
  │  ├─ web/          # Next.js — primary product
  │  └─ mobile/       # Expo — iOS + Android companion
  ├─ packages/
  │  ├─ types/        # zod schemas + TS types
  │  ├─ api-client/   # typed client for /api/v1
  │  ├─ core/         # credit prices, content limits, validation, status labels
  │  ├─ i18n/         # te / hi / en strings
  │  └─ tokens/       # colours, type, spacing
  ├─ workers/
  │  └─ clipper/      # Python clip engine
  └─ docs/
     ├─ SPEC.pdf
     └─ WAVE0.md
  ```
- [x] Shared TypeScript base config; `pnpm dev` runs web + mobile
- [ ] ESLint / Prettier shared config
- [ ] Branch rules: `main` protected, feature branches + pull requests

**Done when:** a fresh clone runs `pnpm install && pnpm dev` and both apps start.
**Estimate:** 0.5–1 day

### T-02 · Move the existing Zepply app into `apps/web`
**Goal:** reuse the existing Zepply web app as the web base.
- [x] **Base = the GitHub repo `satyaij6/zepply`** (Next.js 16, React 19, Prisma, NextAuth; waitlist landing + Instagram comment→DM automation, leads, analytics, privacy/data-deletion pages). Moved into `apps/web` with `git mv`, so its history is kept
- [x] Package renamed to `@zepply/web`; `apps/web/.env.example` lists every variable the app reads
- [x] `next build` passes inside the monorepo (all 28 routes); dev server serves the home page
- [ ] The older voice-agent app (`Desktop/Zepply - Copy`, Next.js 14: agents, calls, call campaigns, Razorpay billing) and its `voice-engine` stay outside the repo for now; port them as the Business Pro voice module in Wave 3 (B5)
- [x] Replace `prisma db push` in `apps/web/vercel.json` with Prisma migrations (see T-08). Baseline is `0_init`; production must be marked with `prisma migrate resolve --applied 0_init` once, before the first deploy that runs `migrate deploy`
- [ ] Set Vercel **Root Directory** to `apps/web` when this layout merges to `main`

**Done when:** the web app builds and runs from `apps/web` with the same behaviour as before.
**Depends on:** T-01 · **Estimate:** 0.5–1 day

### T-03 · Expo mobile app shell
**Goal:** the companion app skeleton (spec §5.5–5.6).
- [x] Expo SDK 57 + Expo Router + TypeScript in `apps/mobile` (Android bundle builds; shared `@zepply/i18n` resolves)
- [ ] Tabs: **Approvals · Inbox · Create · Activity · Profile** (screens can be placeholders)
- [ ] Uses `packages/tokens` and `packages/i18n` (Telugu/Hindi/English switch works)
- [ ] EAS project configured; internal build installs on one Android and one iPhone

**Done when:** a placeholder build runs on real devices via EAS.
**Depends on:** T-01, T-04 · **Estimate:** 1–2 days

### T-04 · Shared packages
- [ ] `packages/types`: zod schemas for the Section 6 entities (workspace, member, channel_account, brand_kit, asset, content_item, generation_job, credit_ledger, device, …)
- [ ] `packages/core`: content status enum and labels, credit price table (as config), per-platform limits (caption length, media counts, aspect ratios)
- [x] `packages/i18n`: string catalogue structure for `en`, `te`, `hi`, used by both apps (te/hi strings still to be written by native speakers)
- [ ] `packages/tokens`: colours, type scale, spacing, radii
- [x] `packages/api-client`: typed fetch wrapper (endpoints filled in by T-09)

**Done when:** web and mobile both import from every package and type-check.
**Depends on:** T-01 · **Estimate:** 1–2 days

### T-05 · Clip engine as a worker
**Goal:** turn the Python clip CLI into a job-consuming worker without rewriting it (spec M4).
- [x] Copied `Desktop/CLI` code (`clipper/`, `prompts/`, `styles/`, `tests/`, `scripts/`, `assets/`, `requirements.txt`, `SETUP.md`) into `workers/clipper`, without the home-folder git repo or the `out/` renders
- [ ] Docker image with **ffmpeg built with libass + harfbuzz + fribidi** (Telugu caption shaping)
- [ ] `tests/test_telugu_shaping.py` runs in CI and must pass on the worker image
- [ ] Entry point that takes a job (source asset, options) and writes results to storage and the database
- [ ] Keep `prompts/hook_rubric.txt` owned by the product team (code wraps it, never inlines it)
- [ ] Secrets (`SARVAM_API_KEY`, `ANTHROPIC_API_KEY`) from the secret store, never committed. Keep TLS verification on (no `verify=False`)

**Done when:** a job processes a sample video end-to-end in staging and returns ranked clips.
**Depends on:** T-01, T-10 · **Estimate:** 2–3 days

### T-06 · Environments and deployment
- [ ] **Two Supabase projects:** `zepply-staging`, `zepply-prod`
- [ ] Web hosting for `apps/web` (staging and production) with preview deploys per pull request
- [ ] Worker hosting for `workers/clipper` (VM or container service; GPU optional, alignment is ~18–28× faster on GPU)
- [ ] Redis for the job queue (staging and production)
- [ ] Secrets in the hosting secret store; `.env.example` documents every variable
- [ ] CI: lint, type-check, tests on every pull request

**Done when:** merging to `main` deploys staging automatically; production deploys by manual promotion.
**Depends on:** T-01 · **Estimate:** 1–2 days

### T-07 · Login, workspaces and team roles (M1 foundation)
- [ ] Supabase Auth on web and mobile: email OTP and Google; phone OTP for India
- [ ] Sign-up flow asks **"I'm a creator" / "I'm a business"** → creates `workspace` with `type`
- [ ] Language step: content languages (multi-select) + UI language
- [ ] Roles: owner, admin, editor, viewer; invite by email
- [ ] Creator → Business conversion keeps all data

**Done when:** a new user signs up on web **and** mobile, lands in their workspace, and role checks are enforced on the server.
**Depends on:** T-02, T-03, T-08 · **Estimate:** 2–3 days

### T-08 · Database schema and access rules (spec §6)
- [ ] Migrations for every Section 6 entity, including `device` (push tokens)
- [ ] `workspace_id` on every tenant table; **row-level security** policies on all of them
- [ ] Automated test: a user in workspace A cannot read or write workspace B's rows
- [ ] Encrypted columns for OAuth tokens (`channel_account.access_token`)
- [ ] Seed script for local development (fake data only, separate from demo code)

**Done when:** migrations run cleanly on staging and the isolation test passes in CI.
**Depends on:** T-06 · **Estimate:** 2 days

### T-09 · API v1 skeleton
**Goal:** one API for web and mobile (spec §5.7).
- [ ] Versioned REST routes under `/api/v1/…` with bearer-token auth (Supabase JWT)
- [ ] First endpoints: `GET /me`, `GET/PATCH /workspace`, `GET/POST /members`, `GET /jobs/:id`
- [ ] Standard error format; idempotency-key support for POST
- [ ] OpenAPI description, so `packages/api-client` is generated or typed from it
- [ ] Web pages use the same endpoints as mobile for business data

**Done when:** both apps load the workspace through `packages/api-client`.
**Depends on:** T-07, T-08 · **Estimate:** 2 days

### T-10 · Job queue and worker skeleton
- [ ] BullMQ on Redis (pending OD2); queues: `generate`, `render`, `publish`, `sync`, `clip`
- [ ] Every slow action is a job: the API enqueues and returns a `job_id`; clients poll or subscribe for progress
- [ ] Retries with backoff, dead-letter queue, admin page to re-run a failed job
- [ ] `generation_job` row records provider, duration, units and **cost in INR**

**Done when:** a dummy job runs from the API → queue → worker → status visible in the web app and mobile app.
**Depends on:** T-06, T-08 · **Estimate:** 1–2 days

### T-11 · Provider adapters skeleton
- [ ] Internal interfaces: `generateText`, `generateImage`, `generateVideo`, `transcribe`, `textToSpeech`, `publishPost`, `sendMessage`
- [ ] One implementation each where a vendor is already known (LLM, speech-to-text); stubs for the rest
- [ ] No vendor SDK imported outside its adapter
- [ ] Provider names never reach user-facing text

**Done when:** a text-generation job runs through the adapter and logs its cost.
**Depends on:** T-10 · **Estimate:** 1 day

### T-12 · Credit ledger skeleton (M9 foundation)
- [ ] Append-only `credit_ledger`; balance = sum of entries
- [ ] Flow: **reserve** on job start → **commit** on success → **release** on failure
- [ ] Every spend requires a confirmation token from the client (no silent deductions)
- [ ] Free-redo flag supported in the ledger reason codes
- [ ] Nightly reconciliation job; alert on mismatch

**Done when:** tests prove a failed job never leaves credits deducted and a retried request never charges twice.
**Depends on:** T-08, T-10 · **Estimate:** 1–2 days

### T-13 · Meta test flow (needed for App Review)
- [ ] Meta developer app in development mode (from F2); test Instagram Professional account
- [ ] Connect Instagram through official login → store an encrypted token in `channel_account`
- [ ] Publish one image post from staging through the `publishPost` adapter
- [ ] Receive a comment webhook (signature verified, stored, queued) and show it in a basic inbox list
- [ ] Record screen videos of each flow for the App Review submission

**Done when:** connect → publish → comment-received works end to end on staging, and the recordings are handed to the founder.
**Depends on:** T-09, T-10, T-11, F2 · **Estimate:** 2–3 days

### T-14 · Separate demo code from the product
- [ ] Move client demo material out of production paths: the `NEXT_PUBLIC_DEMO_CLIENT=rnt` mode, `lib/demo/`, and the `/api/dev/seed-*` routes
- [ ] Dev-only routes disabled in production builds
- [ ] Voice-agent routes (`agents`, `calls`, `phone-numbers`, `voices`, `dispatch`) kept and moved behind the Business Pro entitlement for Wave 3

**Done when:** a production build contains no demo or seed routes.
**Depends on:** T-02 · **Estimate:** 0.5 day

### T-15 · Monitoring and basics
- [ ] Error tracking on web, mobile, API and workers
- [ ] Structured logs with `workspace_id` and `job_id`
- [ ] Uptime check on webhook endpoints
- [ ] Product event tracking set up with the first events: `workspace_created`, `signup_completed`, `channel_connected`

**Done when:** an error thrown in staging shows up in the error tracker with workspace and job context.
**Depends on:** T-06 · **Estimate:** 1 day

### Dependency order (summary)

```
T-01 ─┬─ T-02 ── T-14
      ├─ T-04 ── T-03
      └─ T-06 ─┬─ T-08 ─┬─ T-07 ── T-09 ─┐
               │        └─ T-10 ─┬─ T-11 ┼─ T-13 (+ F2)
               │                 ├─ T-12 │
               │                 └─ T-05 │
               └─ T-15                   ┘
```

---

## Part C — Decisions to close in the first meeting

| # | Decision | Recommendation (spec §12.2) | Final answer |
|---|---|---|---|
| OD1 | Repository layout | Monorepo (Turborepo + pnpm): apps/web, apps/mobile, shared packages; Python worker as its own package | |
| OD2 | Job queue | BullMQ on Redis | Postgres for now: clip jobs are rows in `ClipJob`, claimed with `FOR UPDATE SKIP LOCKED` (6 Oct 2026). Move to BullMQ when more job types arrive |
| OD3 | Image / video / voiceover vendors | Bake-off on product fidelity + Telugu text (F7 test set) before choosing | |
| OD4 | WhatsApp access | Direct Cloud API unless onboarding speed needs a provider (BSP) | |
| OD5 | Final pricing and credit prices | Validate with pilot users (F5) during Wave 1 | |
| OD6 | Mobile payments | Entitlement service (e.g. RevenueCat): store purchase in app, Razorpay on web | |

---

## Part D — What comes next: Wave 1 build order

Wave 1 ships the **Creator plan on web, with the mobile companion**. Build in this order, so a usable product exists early:

| # | Module | Why in this position |
|---|---|---|
| 1 | **M1** Onboarding and workspaces | Finishes what T-07 started; first-run experience |
| 2 | **M2** Brand kit from a link | Every later output depends on it |
| 3 | **M3** Posts and calendar + **M9** Credits | First real value: on-brand posts; credits must exist before anything costs money |
| 4 | **M10** Approval queue | Users review before anything goes live (mobile swipe-to-approve) |
| 5 | **M6** Auto-posting | The loop starts running on its own |
| 6 | **M7** Instagram DM automation | The "Reply" in Create. Reply. Multiply. |
| 7 | **M4** Clip engine | Long-form → shorts using the existing worker |
| 8 | **M5** Reels generator and editor | Most complex creation feature, built on the pieces above |
| 9 | **M8** Growth analytics | The "Multiply": measure and feed back into planning |

**Wave 1 exit criteria (spec §11.1):** 20+ active creators · draft approval rate ≥ 60% · publish success ≥ 99% · Meta App Review approved.

---

## Product rules to keep in mind on every ticket (spec §3)

1. Never alter the real product in photos or videos.
2. Edit, don't regenerate: every output editable in parts.
3. If the AI got it wrong, the redo is free.
4. Ask before spending credits. No silent deductions.
5. Human approval by default; autopilot is earned.
6. Platform-safe growth only: official APIs, no bots.
7. Telugu, Hindi and English are first-class from day one.
8. Transparent and compliant (DPDP Act, Meta policy).
9. Only the Zepply brand in the UI; no provider names.
