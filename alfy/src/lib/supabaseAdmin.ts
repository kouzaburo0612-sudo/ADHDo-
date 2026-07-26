import { createClient, SupabaseClient } from "@supabase/supabase-js";

// サーバー側専用。service role キーは絶対にクライアントへ渡さないこと。
let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です");
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
