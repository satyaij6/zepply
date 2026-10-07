"use client";

import { useEffect, useRef, useState } from "react";
import { buildReelHtml, FORMATS, type ReelFormat, type ReelLength, type ReelMusic, type ReelVariables } from "@zepply/reels";
import { TEMPLATE_PATH } from "@/lib/reels/options";

let templateHtml: Promise<string> | null = null;
const loadTemplate = () => (templateHtml ??= fetch(`${TEMPLATE_PATH}index.html`).then((r) => (r.ok ? r.text() : Promise.reject(r.status))));

/**
 * The reel itself, playing live in the browser: the same template and build step the
 * render worker uses, so the preview is what renders. Rebuilds (debounced) on every change.
 */
export function ReelPreview({
  format,
  length,
  music,
  variables,
  className = "",
}: {
  format: ReelFormat;
  length: ReelLength;
  music: ReelMusic;
  variables: Partial<ReelVariables>;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLElement | null>(null);
  const [failed, setFailed] = useState(false);
  const { width, height } = FORMATS[format];

  // The player is a custom element; register it and create it on the client only.
  useEffect(() => {
    let alive = true;
    import("@hyperframes/player").then(() => {
      if (!alive || !host.current || player.current) return;
      const el = document.createElement("hyperframes-player");
      el.setAttribute("controls", "");
      el.setAttribute("autoplay", "");
      el.setAttribute("loop", "");
      el.setAttribute("muted", "");
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.display = "block";
      host.current.appendChild(el);
      player.current = el;
    });
    return () => {
      alive = false;
      player.current?.remove();
      player.current = null;
    };
  }, []);

  const key = JSON.stringify([format, length, music, variables]);
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      loadTemplate()
        .then((html) => {
          if (!alive) return;
          const doc = buildReelHtml(html, {
            format,
            length,
            music,
            variables,
            inlineVariables: true,
            baseHref: new URL(TEMPLATE_PATH, window.location.origin).href,
          });
          const apply = () => {
            if (!alive) return;
            if (!player.current) return void setTimeout(apply, 100);
            player.current.setAttribute("width", String(width));
            player.current.setAttribute("height", String(height));
            player.current.setAttribute("srcdoc", doc);
          };
          apply();
          setFailed(false);
        })
        .catch(() => alive && setFailed(true));
    }, 450);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // `key` captures every input; the values themselves are read inside
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div
      className={`relative mx-auto overflow-hidden rounded-[22px] bg-[#08080B] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)] ring-1 ring-black/5 ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <div ref={host} className="absolute inset-0" />
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-zinc-400">
          The preview couldn&apos;t load. Check your connection and refresh.
        </div>
      )}
    </div>
  );
}
