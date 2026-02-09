"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { z } from "zod";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  name: z.string().min(1).max(80).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") || "") || undefined,
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
    };

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      toast.error("Please check your inputs (password must be 8+ chars).");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      setLoading(false);
      toast.error(json?.error?.message || "Registration failed");
      return;
    }

    toast.success("Account created. Redirecting...");

    // Auto-login: use redirect mode to avoid JSON parsing issues.
    try {
      await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        callbackUrl: "/app/dashboard",
      });
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
          Create account
        </h1>
        <p className="text-sm text-muted-foreground">Start building your AI voice library.</p>
      </div>
      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="name">Name (optional)</Label>
          <Input id="name" name="name" autoComplete="name" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
          <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
        </div>
        <Button type="submit" disabled={loading} className="rounded-full">
          {loading ? "Creating..." : "Create account"}
        </Button>
      </form>
      <p className="mt-5 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
