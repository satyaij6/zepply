"use client";

import type { Draft } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Path } from "@/lib/onboarding/options";
import type { OnboardingState } from "@/lib/onboarding/state";
import { StepAbout, type About } from "./StepAbout";
import { StepBrandKit } from "./StepBrandKit";
import { StepConnect } from "./StepConnect";
import { StepContent } from "./StepContent";
import { StepDone } from "./StepDone";
import { StepPath } from "./StepPath";
import { FitFrame, Header, api } from "./ui";

type DraftJson = Omit<Draft, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };

/**
 * The /start flow. Every step saves before moving on, so a refresh, a trip to Instagram and back,
 * or coming back tomorrow all resume at the same step with the same answers.
 */
export function Wizard({ initial, connectError }: { initial: OnboardingState; connectError: string | null }) {
  const router = useRouter();
  // English is picked to start with, as most people create in it
  const [state, setState] = useState(() => (initial.languages.length ? initial : { ...initial, languages: ["en"] }));
  // Without a saved path, later steps can't render: start from the beginning
  const [step, setStep] = useState(initial.path ? Math.min(initial.step, 6) : 1);
  const [about, setAbout] = useState<About>({
    name: initial.name,
    niche: initial.niche,
    goals: initial.goals,
    brandName: initial.brandName,
    location: initial.location,
  });
  // Re-read the brand after (re)connecting Instagram; otherwise reuse the saved kit
  const [analyse, setAnalyse] = useState(!initial.hasBrandKit || initial.step <= 3);
  const [drafts, setDrafts] = useState<DraftJson[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = (n: number) => {
    setError(null);
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Saves answers plus the step being moved to, then moves */
  const saveAndGo = async (to: number, answers: Record<string, unknown> = {}) => {
    setBusy(true);
    setError(null);
    try {
      const next = await api<OnboardingState>("/api/onboarding", { method: "PUT", json: { ...answers, step: to } });
      setState(next);
      go(to);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/onboarding/complete", { method: "POST" });
      router.push("/dashboard");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const onAnalysed = useCallback(() => setAnalyse(false), []);
  const path = (state.path as Path | null) ?? null;

  return (
    // Desktop: exactly one screen tall, each step fitted inside (FitFrame). Phones scroll normally.
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <Header onSkip={finish} skipping={busy && step !== 6} />
      <FitFrame key={step}>
      <main className="px-4 pb-6 pt-6 sm:px-8 lg:pt-7">
        {step === 1 && (
          <StepPath
            path={path}
            languages={state.languages}
            onChange={(p) => setState((s) => ({ ...s, ...p }))}
            onNext={() => saveAndGo(2, { path: state.path, languages: state.languages })}
            busy={busy}
            error={error}
          />
        )}
        {step === 2 && path && (
          <StepAbout
            path={path}
            value={about}
            onChange={(p) => setAbout((a) => ({ ...a, ...p }))}
            onBack={() => go(1)}
            onNext={() =>
              saveAndGo(3, {
                name: about.name.trim(),
                niche: about.niche,
                goals: about.goals,
                ...(path === "business" ? { brandName: about.brandName.trim(), location: about.location.trim() } : { brandName: about.name.trim() }),
              })
            }
            busy={busy}
            error={error}
          />
        )}
        {step === 3 && (
          <StepConnect
            instagram={state.instagram}
            connectError={connectError}
            onBack={() => go(2)}
            onNext={() => {
              setAnalyse(true);
              saveAndGo(4);
            }}
            busy={busy}
            error={error}
          />
        )}
        {step === 4 && <StepBrandKit analyse={analyse} onAnalysed={onAnalysed} onBack={() => go(3)} onNext={() => saveAndGo(5)} />}
        {step === 5 && (
          <StepContent
            onBack={() => go(4)}
            onNext={(list) => {
              setDrafts(list);
              saveAndGo(6);
            }}
          />
        )}
        {step === 6 && <StepDoneLoader drafts={drafts} setDrafts={setDrafts} instagram={state.instagram?.username ?? null} onBack={() => go(5)} onFinish={finish} busy={busy} error={error} />}
      </main>
      </FitFrame>
    </div>
  );
}

/** Step 6 after a refresh doesn't have the drafts in memory: fetch them once */
function StepDoneLoader({
  drafts,
  setDrafts,
  ...rest
}: {
  drafts: DraftJson[];
  setDrafts: (d: DraftJson[]) => void;
  instagram: string | null;
  onBack: () => void;
  onFinish: () => void;
  busy: boolean;
  error: string | null;
}) {
  const missing = drafts.length === 0;
  useEffect(() => {
    if (!missing) return;
    api<{ drafts: DraftJson[] }>("/api/onboarding/samples")
      .then(({ drafts }) => setDrafts(drafts))
      .catch(() => {});
  }, [missing, setDrafts]);
  return <StepDone drafts={drafts} {...rest} />;
}
