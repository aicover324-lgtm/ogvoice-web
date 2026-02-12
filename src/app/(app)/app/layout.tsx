import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AppSidebar } from "@/components/app/app-sidebar";
import { MobileNav } from "@/components/app/mobile-nav";
import { UserMenu } from "@/components/app/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="min-h-dvh">
      <div className="flex">
        <AppSidebar />
        <div className="flex min-h-dvh flex-1 flex-col">
          <header className="sticky top-0 z-30 bg-[#070d24]/95">
            <div className="flex h-16 items-center justify-between px-4">
              <div className="flex items-center gap-2 md:hidden">
                <MobileNav />
                <div className="font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                  OG Voice
                </div>
              </div>
              <div className="hidden md:block" />
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <UserMenu />
              </div>
            </div>
          </header>
          <div className="flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
