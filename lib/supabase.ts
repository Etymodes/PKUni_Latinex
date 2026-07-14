import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://tudwzkosrzrusxgpjkfe.supabase.co",
  "sb_publishable_egUjJAxCx5wnNT4yZUk6DQ_d_4m-XQ5",
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
      storageKey: "pkuni-latinex-auth-v1",
    },
  },
);

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) headers.set("authorization", `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers });
}
