# Zepply

**Create. Reply. Multiply.** — the always-on AI marketing platform for creators and businesses.

Product spec: [`docs/SPEC.pdf`](docs/SPEC.pdf) · Current task plan: [`docs/WAVE0.md`](docs/WAVE0.md)

## Repository layout

```
zepply-platform/
├─ apps/
│  ├─ web/          Next.js 16 — primary product + public site (waitlist landing,
│  │                Instagram comment→DM automation, leads, analytics)
│  └─ mobile/       Expo SDK 57 — iOS + Android companion app
├─ packages/
│  ├─ types/        zod schemas + TypeScript types shared by web, mobile and API
│  ├─ api-client/   typed client for /api/v1
│  ├─ core/         shared product rules (statuses, roles, limits)
│  ├─ i18n/         UI strings (en, te, hi — missing keys fall back to English)
│  └─ tokens/       design tokens (colours, fonts, spacing)
├─ workers/
│  └─ clipper/      Python clip engine (long-form → short clips); see its SETUP.md
└─ docs/            spec and task plan
```

`apps/web` keeps the full history of the original `zepply` repository (moved with `git mv`).

## Getting started

Requirements: **Node 20.9+** (22 recommended), **pnpm 10**, Git.

```bash
npm install -g pnpm@10
pnpm install

cp apps/web/.env.example apps/web/.env.local   # fill in, or `vercel env pull`
pnpm --filter @zepply/web exec prisma generate

pnpm dev:web       # web app on http://localhost:3000
pnpm dev:mobile    # Expo dev server (scan the QR with Expo Go)
```

Other commands (run from the root):

| Command | What it does |
|---|---|
| `pnpm build` | Builds every app and package |
| `pnpm typecheck` | Type-checks every app and package |
| `pnpm lint` | Lints every app |
| `pnpm --filter @zepply/mobile exec expo install <pkg>` | Adds a mobile dependency at the SDK-compatible version (always use this for mobile) |

## Rules worth knowing

- **Two React versions on purpose.** Web uses React 19.2.4; mobile must use exactly the React version its React Native release ships (19.2.3 for SDK 57). pnpm's isolated installs keep them apart — don't switch to npm/yarn workspaces, which would hoist one copy and break an app.
- **Shared packages ship TypeScript source.** Web compiles them via `transpilePackages` in `apps/web/next.config.ts`; Metro compiles them for mobile. Add a new package to that list.
- **Install scripts are allow-listed** in `pnpm-workspace.yaml` (`onlyBuiltDependencies`). Add a package there only if it genuinely needs its install script.
- **Secrets never get committed.** Every `.env*` is git-ignored except `.env.example`.
- **Brand:** only the Zepply name in user-facing UI — never provider names (voice, AI model vendors). Never use "24/7" wording in copy.

## Deployment (Vercel)

The web app deploys from `apps/web`. When this monorepo layout reaches `main`, set **Project → Settings → Root Directory** to `apps/web` in Vercel (install command is `pnpm install`, from `apps/web/vercel.json`). Until then, production keeps building the old layout.

> Note: `apps/web/vercel.json` runs `prisma db push` on every build, which applies schema changes straight to the production database. Replace it with Prisma migrations before the schema starts changing in Wave 0 (ticket T-08).

## Machine notes (Windows)

- If `git` HTTPS fails with a certificate error (antivirus HTTPS scanning), this repo is configured with `http.sslBackend=schannel`, which verifies against the Windows certificate store. Never disable verification.
- pnpm 12's native `pnpm.exe` was removed by antivirus on the setup machine; pnpm 10 (pure JavaScript) is used instead.
