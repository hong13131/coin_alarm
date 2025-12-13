import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { Database } from "./types/supabase";

// App Router 서버 사이드에서 사용할 Supabase 클라이언트 (쿠키 핸들링 명시)
export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options?: Partial<CookieOptions>) =>
          cookieStore.set({ name, value, ...options }),
        remove: (name: string, options?: Partial<CookieOptions>) =>
          cookieStore.set({ name, value: "", ...options, maxAge: 0 }),
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach((cookie) => cookieStore.set(cookie));
        },
      },
    },
  );
};
