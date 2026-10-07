"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Suspense, useEffect, useState } from "react";

// Problems the Instagram callback can send back here (see app/api/instagram/callback/route.ts)
const ERRORS: Record<string, { title: string; body: string }> = {
  instagram_in_use: {
    title: "That Instagram is already connected",
    body: "This Instagram account is linked to a different Zepply account. Log in to that account, or disconnect Instagram there first.",
  },
  callback_failed: {
    title: "Couldn't connect Instagram",
    body: "We couldn't reach Instagram just now. Please try again in a moment.",
  },
};

type IgAccount = { igUsername: string; igProfilePic: string | null };

export default function ConnectedPage() {
  return (
    <Suspense fallback={null}>
      <ConnectedCard />
    </Suspense>
  );
}

function ConnectedCard() {
  const { status } = useSession();
  const router = useRouter();
  const problem = ERRORS[useSearchParams().get("error") ?? ""];
  const [account, setAccount] = useState<IgAccount | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // The session holds the person's Google name, so read the Instagram handle from their account
  useEffect(() => {
    if (status !== "authenticated" || problem) return;
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((user) => setAccount(user?.igAccounts?.[0] ?? null))
      .catch(() => setAccount(null));
  }, [status, problem]);

  if (status === "loading") return null;

  const username = account?.igUsername;
  const profilePic = account?.igProfilePic;

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #fdf0ff 0%, #fff5f8 50%, #f0f4ff 100%)",
      fontFamily: "'Poppins', sans-serif",
      padding: "24px",
    }}>
      <div style={{
        background: "#ffffff",
        borderRadius: 24,
        padding: "40px 36px",
        maxWidth: 400,
        width: "100%",
        boxShadow: "0 8px 48px rgba(0,0,0,0.10)",
        textAlign: "center",
      }}>
        {/* Checkmark ring */}
        <div style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #FEDA75, #FA7E1E, #D62976, #962FBF, #4F5BD5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
          boxShadow: "0 4px 20px rgba(214,41,118,0.30)",
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {problem ? (
              <>
                <line x1="12" y1="7" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </>
            ) : (
              <polyline points="20 6 9 17 4 12" />
            )}
          </svg>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0d0d0d", margin: "0 0 8px" }}>
          {problem ? problem.title : "Instagram connected!"}
        </h2>

        {/* Account chip */}
        {!problem && username && (
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            background: "#f5f5f7",
            borderRadius: 100,
            padding: "8px 16px 8px 8px",
            margin: "12px 0 0",
          }}>
            {profilePic ? (
              <Image
                src={profilePic}
                alt={username}
                width={32}
                height={32}
                style={{ borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <div style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #D62976, #4F5BD5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: 13,
                fontWeight: 700,
              }}>
                {username[0].toUpperCase()}
              </div>
            )}
            <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>
              @{username}
            </span>
          </div>
        )}

        <p style={{ fontSize: 14, color: "#6b6b6b", margin: "16px 0 28px", lineHeight: 1.6 }}>
          {problem ? problem.body : "Zepply is now linked to your account and ready to auto-reply to your comments and DMs."}
        </p>

        <button
          onClick={() => router.push(problem ? "/api/instagram/connect" : "/dashboard")}
          style={{
            width: "100%",
            padding: "14px 24px",
            background: "#0d0d0d",
            color: "#ffffff",
            border: "none",
            borderRadius: 100,
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 600,
            fontSize: 15,
            cursor: "pointer",
            transition: "background 0.18s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "#333")}
          onMouseLeave={e => (e.currentTarget.style.background = "#0d0d0d")}
        >
          {problem ? "Try again" : "Go to your workspace"}
        </button>
      </div>
    </div>
  );
}
