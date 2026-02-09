import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  alternates: { canonical: "/legal/privacy" },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
        Privacy Policy
      </h1>
      <div className="mt-6 space-y-4 text-sm leading-7 text-muted-foreground">
        <p>This is template text for an MVP. Replace with counsel-reviewed policy before production.</p>
        <div>
          <h2 className="text-base font-semibold text-foreground">What we collect</h2>
          <p>Account information (email, name), usage metadata, and uploaded audio files you provide.</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">How we use it</h2>
          <p>To provide the service: authentication, storage of datasets, job orchestration, and billing.</p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Storage</h2>
          <p>
            Audio uploads are stored in an S3-compatible object store (e.g., AWS S3, Cloudflare R2, or MinIO for local development).
          </p>
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Contact</h2>
          <p>Contact support to request deletion/export.</p>
        </div>
      </div>
    </main>
  );
}
