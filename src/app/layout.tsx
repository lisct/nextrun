import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NextRun — Friday Night Basketball",
  description:
    "Pickup basketball queue, stats, and payment tracker for Friday night runs.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NextRun",
  },
  openGraph: {
    title: "NextRun",
    description: "Friday night pickup basketball — queue up, run it back.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-950 text-white">{children}</body>
    </html>
  );
}
