import { Suspense } from "react";
import { redirect } from "next/navigation";
import { emailEnabled } from "@/lib/email";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  if (!emailEnabled()) redirect("/auth/login");
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
