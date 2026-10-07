"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { isDemo } from "@/components/layout/DashboardLayout";
import { BrandFields, EMPTY_BRAND, type Brand } from "@/components/create/BrandFields";
import { LANGUAGES } from "@/lib/reels/options";

export default function BrandKitPage() {
  const [demo] = useState(isDemo);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (demo) return void queueMicrotask(() => setBrand(EMPTY_BRAND));
    fetch("/api/brand-kit")
      .then(async (r) => {
        if (r.status === 401) return window.location.replace("/login");
        if (r.status === 403) {
          setLocked(true);
          return;
        }
        const { kit } = await r.json();
        setBrand(
          kit
            ? {
                brandName: kit.brandName ?? "",
                handle: kit.handle ?? "",
                about: kit.about ?? "",
                location: kit.location ?? "",
                accent: kit.accent,
                language: kit.language,
                logo: kit.logoPath && kit.logoUrl ? { path: kit.logoPath, url: kit.logoUrl } : null,
                photos: kit.photos ?? [],
              }
            : EMPTY_BRAND,
        );
      })
      .catch(() => setError("Couldn't load your brand kit"));
  }, [demo]);

  async function save() {
    if (!brand) return;
    setState("saving");
    setError(null);
    if (demo) {
      setTimeout(() => setState("saved"), 400);
      return;
    }
    const res = await fetch("/api/brand-kit", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        brandName: brand.brandName,
        handle: brand.handle,
        about: brand.about,
        location: brand.location,
        accent: brand.accent,
        language: brand.language,
        logoPath: brand.logo?.path ?? null,
        photoPaths: brand.photos.map((p) => p.path),
      }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setError(data?.error || "Couldn't save");
      setState("idle");
      return;
    }
    setState("saved");
  }

  return (
    <div className="max-w-3xl pb-12 pt-2">
      <h1 className="font-display text-[clamp(28px,3vw,40px)] font-semibold leading-tight tracking-[-0.03em]">Brand kit</h1>
      <p className="mt-2 text-[15px] text-app-muted">Your name, logo, colour and photos. Every reel you make starts from here.</p>

      {locked ? (
        <p className="mt-8 rounded-2xl bg-white p-5 text-sm text-app-muted ring-1 ring-app-line">The brand kit comes with promo reels, which are invite-only for now.</p>
      ) : !brand ? (
        <div className="mt-10 flex justify-center text-app-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="mt-8 space-y-6 rounded-3xl bg-white p-5 ring-1 ring-app-line sm:p-7">
          <BrandFields
            value={brand}
            demo={demo}
            onChange={(b) => {
              setBrand(b);
              setState("idle");
            }}
          />
          <div>
            <p className="text-sm font-semibold">Usual language</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  aria-pressed={brand.language === l.value}
                  onClick={() => {
                    setBrand({ ...brand, language: l.value });
                    setState("idle");
                  }}
                  className={`h-10 rounded-full border px-4 text-sm font-semibold transition ${
                    brand.language === l.value ? "border-app-ink bg-app-ink text-white" : "border-app-line bg-white hover:border-zinc-300"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
          <div className="flex items-center gap-3 border-t border-app-line pt-5">
            <button
              type="button"
              onClick={save}
              disabled={!brand.brandName.trim() || state === "saving"}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-app-ink px-5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {state === "saving" && <Loader2 className="h-4 w-4 animate-spin" />}
              {state === "saved" ? <><Check className="h-4 w-4" /> Saved</> : "Save brand kit"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
