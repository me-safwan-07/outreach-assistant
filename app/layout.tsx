import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { Navbar } from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Outreach Assistant — AI Cold Email & Prospecting Platform",
  description:
    "AI-powered outreach assistant for job seekers. Scrape LinkedIn companies, identify decision-makers, verify work emails, and generate personalized pitches.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isMock = process.env.MOCK_MODE === "true";

  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen antialiased" style={{ background: "var(--bg)", color: "var(--text)" }}>

        {/* Client Component handles all interactivity */}
        <Navbar isMock={isMock} />

        {/* Main Content */}
        <main className="relative z-10 max-w-7xl mx-auto px-5 py-8">
          {children}
        </main>

        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "var(--bg-1)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              borderRadius: "var(--radius-sm)",
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );
}
