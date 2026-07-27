import { randomBytes } from "crypto";

const CODE_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"; // 紛らわしい文字を除外

function randomFrom(chars: string, length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

// URL用スラッグ(8桁英数)
export function generateCode(): string {
  return randomFrom(CODE_CHARS, 8);
}

// 管理トークン(URL型・推測不能)
export function generateAdminToken(): string {
  return randomBytes(24).toString("base64url");
}
