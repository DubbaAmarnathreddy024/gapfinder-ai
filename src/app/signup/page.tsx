
import { Suspense } from "react";
import AuthForm from "@/components/auth-form";

export default function SignupPage() {
  return (
    <Suspense fallback={<p className="p-8">Loading registration...</p>}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
