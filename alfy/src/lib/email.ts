import { Resend } from "resend";

// 確定通知・リマインドメール(Resend — 仕様書 §4)
// 個人名・回答内容はログに出力しない(仕様書 §6)

let resend: Resend | null = null;
function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resend) resend = new Resend(key);
  return resend;
}

const FROM = process.env.RESEND_FROM ?? "Alfy <onboarding@resend.dev>";

export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  const c = client();
  if (!c) return false;
  try {
    const { error } = await c.emails.send({ from: FROM, to, subject, text });
    return !error;
  } catch {
    return false;
  }
}
