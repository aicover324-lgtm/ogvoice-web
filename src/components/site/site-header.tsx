import Link from "next/link";
import { getServerSession } from "next-auth";
import { Mic2 } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function initials(name?: string | null, email?: string | null) {
  const base = (name || email || "U").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  const two = (parts[0]?.[0] || "U") + (parts[1]?.[0] || "");
  return two.toUpperCase();
}

export async function SiteHeader() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const avatarAsset = userId
    ? await prisma.uploadAsset
        .findFirst({
          where: { userId, type: "avatar_image" },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        })
        .catch(() => null)
    : null;

  const avatarSrc = avatarAsset ? "/api/users/avatar" : undefined;
  const displayName = session?.user?.name?.trim() || session?.user?.email?.split("@")[0] || "Account";
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b18]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 text-white">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-cyan-500 to-fuchsia-500 shadow-[0_4px_16px_rgba(6,182,212,0.4)]">
              <Mic2 className="h-4 w-4 text-white" />
            </span>
            OG Voice
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <Link href="/#features" className="transition-colors hover:text-cyan-200">Features</Link>
            <Link href="/#how-it-works" className="transition-colors hover:text-cyan-200">How It Works</Link>
            <Link href="/pricing" className="transition-colors hover:text-cyan-200">Pricing</Link>
            <Link href="/faq" className="transition-colors hover:text-cyan-200">FAQ</Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {session?.user ? (
            <>
              <Button
                asChild
                variant="ghost"
                className="og-btn-outline-soft h-10 max-w-[220px] rounded-xl px-2.5 text-slate-200 hover:bg-white/10 hover:text-white"
              >
                <Link href="/app/settings" className="flex items-center gap-2 overflow-hidden">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={avatarSrc} alt="Avatar" />
                    <AvatarFallback className="text-xs">{initials(session.user.name, session.user.email)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm">{displayName}</span>
                </Link>
              </Button>
              <Button asChild className="og-btn-gradient h-10 rounded-xl px-5">
                <Link href="/app/dashboard">Return to app</Link>
              </Button>
            </>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                className="og-btn-outline-soft hidden h-10 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white sm:inline-flex"
              >
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild className="og-btn-gradient h-10 rounded-xl px-5">
                <Link href="/register">Start Free</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
