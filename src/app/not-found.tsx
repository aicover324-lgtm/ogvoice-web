import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-start justify-center gap-4 px-4">
      <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
        Page not found
      </h1>
      <p className="text-muted-foreground">The page you requested does not exist.</p>
      <div className="flex gap-2">
        <Button asChild className="rounded-full">
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/app/dashboard">Go to app</Link>
        </Button>
      </div>
    </main>
  );
}
