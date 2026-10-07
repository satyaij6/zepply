"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_PHOTOS, SWATCHES, type ReelLanguage } from "@/lib/reels/options";
import { colourFromImage, shrinkImage } from "@/lib/reels/images";
import { Field, TextInput } from "./ui";

export type Media = { path: string; url: string };

export type Brand = {
  brandName: string;
  handle: string;
  about: string;
  location: string;
  accent: string;
  logo: Media | null;
  photos: Media[];
  language: ReelLanguage;
};

export const EMPTY_BRAND: Brand = {
  brandName: "",
  handle: "",
  about: "",
  location: "",
  accent: SWATCHES[0],
  logo: null,
  photos: [],
  language: "en",
};

/** Uploads one image (shrunk first). In demo mode the file stays in the browser. */
export async function uploadImage(kind: "logo" | "photo", file: File, demo = false): Promise<{ media: Media; blob: Blob }> {
  if (!IMAGE_TYPES.includes(file.type as (typeof IMAGE_TYPES)[number])) throw new Error("Use a JPG, PNG or WebP image");
  const blob = await shrinkImage(file, kind === "logo" ? 800 : 1600, kind === "logo");
  if (blob.size > MAX_IMAGE_BYTES) throw new Error(`Images can be up to ${MAX_IMAGE_BYTES / 1024 ** 2} MB`);
  if (demo) return { media: { path: `demo/${kind}/${crypto.randomUUID()}`, url: URL.createObjectURL(blob) }, blob };

  const res = await fetch("/api/brand-kit/uploads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, size: blob.size, contentType: blob.type }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Couldn't upload that image");
  const put = await fetch(data.signedUrl, { method: "PUT", headers: { "content-type": blob.type }, body: blob });
  if (!put.ok) throw new Error("The upload didn't finish. Try again.");
  // Show the local copy right away; the signed URL is for later sessions
  return { media: { path: data.path, url: URL.createObjectURL(blob) }, blob };
}

/** Business name, handle, logo, colour and photos. Shared by the wizard and the Brand Kit page. */
export function BrandFields({ value, onChange, demo = false }: { value: Brand; onChange: (next: Brand) => void; demo?: boolean }) {
  const [busy, setBusy] = useState<"logo" | "photo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  // Uploads finish after re-renders; read the newest value, not the one the upload started with
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const set = (patch: Partial<Brand>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    onChange(next);
  };

  async function addLogo(file: File) {
    setBusy("logo");
    setError(null);
    try {
      const { media, blob } = await uploadImage("logo", file, demo);
      const colour = await colourFromImage(blob);
      set({ logo: media, ...(colour ? { accent: colour } : {}) });
      setSuggested(colour);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add the logo");
    } finally {
      setBusy(null);
    }
  }

  async function addPhotos(files: FileList) {
    setBusy("photo");
    setError(null);
    try {
      const room = MAX_PHOTOS - latest.current.photos.length;
      for (const file of Array.from(files).slice(0, room)) {
        const { media } = await uploadImage("photo", file, demo);
        set({ photos: [...latest.current.photos, media] });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that photo");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Business name" htmlFor="brand-name">
          <TextInput id="brand-name" value={value.brandName} maxLength={60} placeholder="Brew House" onChange={(e) => set({ brandName: e.target.value })} />
        </Field>
        <Field label="Instagram handle" htmlFor="brand-handle">
          <TextInput
            id="brand-handle"
            value={value.handle}
            maxLength={40}
            placeholder="@thebrewhouse"
            onChange={(e) => set({ handle: e.target.value.replace(/\s+/g, "") })}
            onBlur={(e) => e.target.value && !e.target.value.startsWith("@") && set({ handle: `@${e.target.value}` })}
          />
        </Field>
        <Field label="Where are you?" hint="Area and city, shown at the end" htmlFor="brand-location">
          <TextInput id="brand-location" value={value.location} maxLength={60} placeholder="Kondapur, Hyderabad" onChange={(e) => set({ location: e.target.value })} />
        </Field>
        <Field label="What do you do?" hint="One line, in your own words" htmlFor="brand-about">
          <TextInput id="brand-about" value={value.about} maxLength={200} placeholder="A cosy café with great cold brew" onChange={(e) => set({ about: e.target.value })} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
        <Field label="Logo" hint="Optional">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => logoInput.current?.click()}
              className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-zinc-300 bg-white text-app-muted transition hover:border-app-ink"
              aria-label={value.logo ? "Change logo" : "Add logo"}
            >
              {busy === "logo" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : value.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={value.logo.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-5 w-5" />
              )}
            </button>
            {value.logo && (
              <button type="button" onClick={() => set({ logo: null })} className="text-sm font-medium text-app-muted underline-offset-2 hover:underline">
                Remove
              </button>
            )}
          </div>
          <input ref={logoInput} type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={(e) => e.target.files?.[0] && addLogo(e.target.files[0])} />
        </Field>

        <Field label="Brand colour" hint={suggested && suggested === value.accent ? "Picked from your logo" : "Used for buttons, highlights and the moving shape"}>
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                aria-pressed={value.accent.toUpperCase() === c}
                onClick={() => set({ accent: c })}
                className={`h-9 w-9 rounded-full transition ${value.accent.toUpperCase() === c ? "ring-2 ring-app-ink ring-offset-2" : "hover:scale-105"}`}
                style={{ background: c }}
              />
            ))}
            {suggested && !SWATCHES.includes(suggested) && (
              <button
                type="button"
                aria-label="Colour from your logo"
                onClick={() => set({ accent: suggested })}
                className={`relative h-9 w-9 rounded-full ${value.accent.toUpperCase() === suggested ? "ring-2 ring-app-ink ring-offset-2" : ""}`}
                style={{ background: suggested }}
              >
                <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 text-app-ink" />
              </button>
            )}
            <label className="relative flex h-9 cursor-pointer items-center gap-2 rounded-full border border-app-line bg-white pl-1 pr-3 text-sm text-app-muted hover:border-zinc-300">
              <span className="h-7 w-7 rounded-full" style={{ background: value.accent }} />
              Custom
              <input type="color" value={value.accent} onChange={(e) => set({ accent: e.target.value.toUpperCase() })} className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
          </div>
        </Field>
      </div>

      <Field label="Photos" hint={`Your shop, products or team. Add 3 to ${MAX_PHOTOS}.`}>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {value.photos.map((p, i) => (
            <div key={p.path} className="group relative aspect-square overflow-hidden rounded-xl bg-app-bg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => set({ photos: value.photos.filter((x) => x.path !== p.path) })}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {value.photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-zinc-300 bg-white text-xs font-medium text-app-muted transition hover:border-app-ink"
            >
              {busy === "photo" ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              {busy === "photo" ? "Adding…" : "Add photos"}
            </button>
          )}
        </div>
        <input
          ref={photoInput}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) addPhotos(e.target.files);
            e.target.value = "";
          }}
        />
      </Field>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
