import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/ui/navbar";
import LegendaryBackground from "@/components/ui/legendary-background";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KickOff | Football scores and fixtures",
  description: "Follow live football scores, fixtures, and match stats.",
  icons: {
    icon: "/kickoff_main_logo.png",
    shortcut: "/kickoff_main_logo.png",
    apple: "/kickoff_main_logo.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col relative overflow-x-hidden bg-background text-foreground">
        <Navbar />
        <LegendaryBackground />
        <div className="relative z-10 flex-1 flex flex-col bg-transparent">
          {children}
        </div>
      </body>
    </html>
  );
}
