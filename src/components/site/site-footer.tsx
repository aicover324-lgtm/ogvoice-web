import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            OG Voice
          </span>
          <span className="ml-2">AI voice platform MVP foundation.</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/legal/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}
