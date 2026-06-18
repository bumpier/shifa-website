import { redirect } from "next/navigation";
import { emailEnabled } from "@/lib/email";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  if (!emailEnabled()) redirect("/auth/login");
  return <ForgotPasswordForm />;
}
