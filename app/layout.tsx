import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const jbMono = JetBrains_Mono({
  variable: "--font-jbmono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RemitDesk — Agent Remittance Ledger",
  description:
    "Scan PCSO Total Current Day reports, ONCOL slips and EPP confirmations into a reconciled running-balance ledger and export to Excel — all in your browser.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${jbMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans text-slate-900">
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
