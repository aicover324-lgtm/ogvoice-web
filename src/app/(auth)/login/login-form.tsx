"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function LoginForm() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/app/dashboard";
  const error = params.get("error");
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
    };
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      return;
    }
    setLoading(true);
    // Use redirect mode to avoid JSON parsing issues.
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      callbackUrl,
    });
    setLoading(false);
  }

  return (
    <Card className="w-full max-w-md p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
          Sign in
        </h1>
        <p className="text-sm text-muted-foreground">Access your voices and datasets.</p>
      </div>

      {error ? (
        <Alert className="mt-5" variant="destructive">
          <AlertTitle>Sign in failed</AlertTitle>
          <AlertDescription>Check your email/password and try again.</AlertDescription>
        </Alert>
      ) : null}
      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit" disabled={loading} className="rounded-full">
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      <p className="mt-5 text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/register" className="text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </Card>
  );
}
