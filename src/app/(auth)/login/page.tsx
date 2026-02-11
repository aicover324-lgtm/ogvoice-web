import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<Card className="og-surface-glass w-full max-w-md p-6">Loading...</Card>}>
      <LoginForm />
    </Suspense>
  );
}
