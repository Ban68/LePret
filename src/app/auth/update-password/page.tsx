import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Configura tu contraseña | LePrêt Capital",
  description: "Define una nueva contraseña para acceder al portal de clientes de LePrêt Capital.",
};

type SearchParams = Record<string, string | string[] | undefined>;

interface UpdatePasswordPageProps {
  searchParams?: Promise<SearchParams>;
}

export default async function UpdatePasswordPage({
  searchParams,
}: UpdatePasswordPageProps) {
  const params = (await searchParams) ?? {};
  const codeParam = params.code;
  const code = Array.isArray(codeParam) ? codeParam[0] : codeParam;

  return (
    <div className="bg-lp-primary-2 py-16 sm:py-24">
      <div className="container mx-auto flex max-w-4xl flex-col items-center px-4 sm:px-6 lg:px-8">
        <ResetPasswordForm code={code} />
      </div>
    </div>
  );
}
