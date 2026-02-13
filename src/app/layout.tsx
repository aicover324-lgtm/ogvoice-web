import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const fontHeading = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const fontBody = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const fontMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const baseUrl = new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: baseUrl,
  title: {
    default: "OG Voice - Voice Cloning & AI Singing Platform",
    template: "%s | OG Voice",
  },
  description:
    "Manage AI voice profiles and datasets, then generate songs with a professional workflow. Training is coming soon.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: "OG Voice",
    description:
      "A production-grade platform foundation for voice cloning and AI singing. Upload datasets, manage voices, and generate songs (placeholder).",
    siteName: "OG Voice",
  },
  twitter: {
    card: "summary_large_image",
    title: "OG Voice",
    description:
      "Upload voice datasets, manage AI voices, and generate songs (placeholder).",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${fontHeading.variable} ${fontBody.variable} ${fontMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
