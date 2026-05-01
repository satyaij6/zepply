import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zepply — Turn Every Comment Into a Customer",
  description:
    "Zepply auto-replies to every Instagram comment, DM, story reply, and new follower. Capture leads on autopilot. 100% Meta-compliant. Built for Indian creators.",
  keywords: ["Instagram automation", "Indian creators", "DM automation", "comment auto-reply", "waitlist", "Instagram DM bot"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preload" as="image" href="/hero-bg.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Kufam:ital,wght@0,400;0,600;0,700;0,800;0,900;1,700&family=Poppins:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased" style={{ fontFamily: "'Inter', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
