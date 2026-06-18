import { emailEnabled } from "@/lib/email";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return <LoginForm emailEnabled={emailEnabled()} />;
}
