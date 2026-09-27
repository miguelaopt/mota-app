"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAllowedEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { step: "email"; email?: string; error?: string }
  | { step: "code"; email: string; error?: string; info?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function sendCode(email: string): Promise<LoginState> {
  if (!EMAIL_RE.test(email)) {
    return { step: "email", email, error: "Escreve um email válido." };
  }
  if (!process.env.ALLOWED_EMAIL) {
    return { step: "email", email, error: "Falta configurar ALLOWED_EMAIL no servidor." };
  }
  if (!isAllowedEmail(email)) {
    return { step: "email", email, error: "Este email não tem acesso a esta app." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/confirm`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    const rateLimited = error.status === 429 || error.code === "over_email_send_rate_limit";
    return {
      step: "email",
      email,
      error: rateLimited
        ? "Pediste demasiados emails seguidos. Espera um pouco e tenta outra vez."
        : "Não foi possível enviar o email. Tenta outra vez.",
    };
  }

  return { step: "code", email, info: `Enviámos um email para ${email}.` };
}

async function verifyCode(email: string, rawToken: string): Promise<LoginState> {
  const token = rawToken.replace(/\D/g, "");
  if (token.length < 6 || token.length > 10) {
    return { step: "code", email, error: "O código tem 6 dígitos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    return { step: "code", email, error: "Código inválido ou expirado. Pede um novo." };
  }

  redirect("/");
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const intent = String(formData.get("intent") ?? "");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  switch (intent) {
    case "send":
      return sendCode(email);
    case "verify":
      return verifyCode(email, String(formData.get("token") ?? ""));
    default:
      return { step: "email", email };
  }
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
