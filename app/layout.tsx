import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zepply — Instagram Automation for Indian Creators",
  description:
    "Auto-reply to every comment, DM, story reply, and new follower. 100% Meta-compliant. Free forever plan. Built for India.",
  keywords: ["Instagram automation", "Indian creators", "DM automation", "comment auto-reply"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Serif:wght@400;500&family=Roboto+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased bg-white dark:bg-gray-950 text-gray-900 dark:text-white">
        {children}
      </body>
    </html>
  );
}
