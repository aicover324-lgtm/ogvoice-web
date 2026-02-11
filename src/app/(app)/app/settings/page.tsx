import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BillingPortalButton } from "@/components/app/billing-portal-button";
import { ImageUploader } from "@/components/app/image-uploader";
import { PageHeader } from "@/components/ui/page-header";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const userId = session!.user.id;

  const [user, sub] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, createdAt: true } }),
    prisma.subscription.findUnique({ where: { userId } }),
  ]);

  return (
    <main className="og-app-main">
      <PageHeader title="Settings" description="Profile, billing, and API placeholders." />

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <div className="text-sm font-semibold">Profile</div>
          <div className="mt-4 grid gap-2 text-sm">
            <div><span className="text-muted-foreground">Email:</span> {user?.email}</div>
            <div><span className="text-muted-foreground">Name:</span> {user?.name || "-"}</div>
            <div><span className="text-muted-foreground">Joined:</span> {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}</div>
          </div>
          <div className="mt-5">
            <div className="text-xs font-semibold text-muted-foreground">Avatar</div>
            <div className="mt-2">
              <ImageUploader
                type="avatar_image"
                preview={{ src: "/api/users/avatar", alt: "Avatar", variant: "avatar", size: 56 }}
                onComplete={() => {
                  /* user-menu uses /api/users/avatar */
                }}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Billing</div>
            <Badge variant="secondary">{sub?.plan || "free"}</Badge>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            Stripe scaffolding is implemented. Configure Stripe env vars to enable checkout + webhooks.
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <BillingPortalButton />
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Current status: {sub?.status || "none"}
          </div>
        </Card>

        <Card className="p-6 md:col-span-2">
          <div className="text-sm font-semibold">API keys (placeholder)</div>
          <div className="mt-2 text-sm text-muted-foreground">
            In a future iteration, you can generate personal API keys here (for CLI tools, integrations, etc.).
          </div>
        </Card>
      </div>
    </main>
  );
}
