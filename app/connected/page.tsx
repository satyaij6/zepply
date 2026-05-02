"use client";

export const dynamic = "force-dynamic";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect } from "react";

export default function ConnectedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") return null;

  const username = session?.user?.name;
  const profilePic = session?.user?.image;

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
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0d0d0d", margin: "0 0 8px" }}>
          Instagram connected!
        </h2>

        {/* Account chip */}
        {username && (
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
          Zepply is now linked to your account and ready to auto-reply to your comments and DMs.
        </p>

        <button
          onClick={() => router.push("/dashboard")}
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
          Go to your workspace
        </button>
      </div>
    </div>
  );
}
