import type { Metadata } from "next";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Blog",
  alternates: { canonical: "/blog" },
};

export default function BlogIndexPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-14">
      <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
        Blog
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Placeholder for launch content (product updates, training guides, case studies).
      </p>
      <div className="mt-10 grid gap-4">
        <Card className="p-6">
          <div className="text-sm font-semibold">Coming soon</div>
          <p className="mt-2 text-sm text-muted-foreground">
            We will add a simple markdown-based blog or headless CMS integration later.
          </p>
        </Card>
      </div>
    </main>
  );
}
