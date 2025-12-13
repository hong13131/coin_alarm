import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./src/lib/types/supabase";

const protectedPaths = ["/", "/api"];
const authFree = ["/login", "/signup", "/api", "/_next", "/favicon", "/public"];

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.pathname;

  // 로그인/회원가입, 정적 파일, 이미지 등은 통과
  if (authFree.some((path) => url.startsWith(path))) {
    return NextResponse.next();
  }

  // 루트/대시보드 등 보호 경로 체크
  if (protectedPaths.some((path) => url.startsWith(path))) {
    const res = NextResponse.next();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (cookies) => {
            cookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
          },
        },
      },
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const isEmailConfirmed = Boolean(session?.user?.email_confirmed_at);

    if (!session || !isEmailConfirmed) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("redirect", url);
      if (!isEmailConfirmed) {
        redirectUrl.searchParams.set("verify", "1");
      }
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets|robots.txt).*)"],
};
