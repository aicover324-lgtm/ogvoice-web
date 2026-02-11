import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<Card className="w-full max-w-md border-white/12 bg-white/[0.04] p-6 text-white">Loading...</Card>}>
      <LoginForm />
    </Suspense>
  );
}
