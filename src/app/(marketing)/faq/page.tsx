import type { Metadata } from "next";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "FAQ",
  alternates: { canonical: "/faq" },
};

const faqs = [
  {
    q: "Do you run voice cloning in this MVP?",
    a: "Not yet. This MVP focuses on the production platform foundation: auth, profiles, secure uploads, and a clean workflow.",
  },
  {
    q: "When will training be available?",
    a: "Training is coming in a future update. We’re not shipping Colab-based training because it’s not production-grade infrastructure.",
  },
  {
    q: "Where are uploads stored?",
    a: "S3-compatible object storage. Locally we use MinIO; in production you can use AWS S3 or Cloudflare R2.",
  },
];

export default function FaqPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
        FAQ
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Quick answers about MVP scope, security posture, and what’s coming next.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {faqs.map((f) => (
          <Card key={f.q} className="p-6">
            <div className="text-sm font-semibold">{f.q}</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{f.a}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
