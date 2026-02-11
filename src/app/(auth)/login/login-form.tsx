"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { LogIn, Sparkles } from "lucide-react";
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
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      callbackUrl,
    });
    setLoading(false);
  }

  return (
    <Card className="w-full max-w-md rounded-3xl border-white/12 bg-[#0a1124]/90 p-6 text-white shadow-[0_22px_80px_rgba(2,8,23,0.45)] backdrop-blur-xl">
      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
        <Sparkles className="h-3.5 w-3.5" />
        Welcome back
      </div>

      <div className="mt-4 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
          Sign in to OG Voice
        </h1>
        <p className="text-sm text-slate-300">Access your voice profiles, cloning workflow, and project history.</p>
      </div>

      {error ? (
        <Alert className="mt-5 border-red-400/30 bg-red-500/10 text-red-100" variant="destructive">
          <AlertTitle>Sign in failed</AlertTitle>
          <AlertDescription>Check your email and password, then try again.</AlertDescription>
        </Alert>
      ) : null}

      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="email" className="text-slate-200">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="h-11 border-white/15 bg-white/[0.04] text-white placeholder:text-slate-400 focus-visible:border-cyan-300/60 focus-visible:ring-cyan-400/40"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password" className="text-slate-200">
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-11 border-white/15 bg-white/[0.04] text-white placeholder:text-slate-400 focus-visible:border-cyan-300/60 focus-visible:ring-cyan-400/40"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="mt-1 h-11 rounded-xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 text-sm font-semibold text-white hover:from-cyan-500 hover:to-fuchsia-500 disabled:pointer-events-auto disabled:cursor-not-allowed"
        >
          <LogIn className="h-4 w-4" />
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="mt-5 text-sm text-slate-300">
        New to OG Voice?{" "}
        <Link href="/register" className="font-medium text-cyan-200 underline underline-offset-4 hover:text-cyan-100">
          Create an account
        </Link>
      </p>
    </Card>
  );
}
