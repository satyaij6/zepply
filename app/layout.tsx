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
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased bg-white dark:bg-gray-950 text-gray-900 dark:text-white">
        {children}
      </body>
    </html>
  );
}
