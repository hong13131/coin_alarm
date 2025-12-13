"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    router.push("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070a14] px-6">
      <div className="w-full max-w-md rounded-2xl border border-[--border] bg-[--card] p-6 text-white shadow-2xl backdrop-blur">
        <h1 className="text-2xl font-semibold">로그인</h1>
        <p className="mt-1 text-sm text-[--muted]">이메일과 비밀번호로 로그인하세요.</p>

        {searchParams.get("verify") === "1" && (
          <p className="mt-2 text-xs text-amber-200">
            이메일 인증 후 로그인 가능합니다. 메일함을 확인하세요.
          </p>
        )}

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-[--muted]">이메일</label>
            <input
              className="mt-1 w-full rounded-lg border border-[--border] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[--accent]"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-sm text-[--muted]">비밀번호</label>
            <input
              className="mt-1 w-full rounded-lg border border-[--border] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[--accent]"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {message && <p className="text-sm text-red-300">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-[#65f8ff] to-[#6ddcfe] px-4 py-2 text-sm font-semibold text-black transition hover:shadow-[0_8px_30px_rgba(101,248,255,0.35)] disabled:opacity-60"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className="mt-4 text-sm text-[--muted]">
          아직 계정이 없나요?{" "}
          <Link href="/signup" className="text-[#65f8ff] hover:underline">
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
}
