import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";

const LoadingFallback = () => (
  <div className="py-20 sm:py-24">
    <div className="container mx-auto max-w-md px-4 sm:px-6 lg:px-8">
      <p className="text-lp-sec-3">Cargando...</p>
    </div>
  </div>
);

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LoginForm />
    </Suspense>
  );
}
