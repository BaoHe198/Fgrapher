import type { Metadata } from "next";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Create your account — Fgrapher",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
