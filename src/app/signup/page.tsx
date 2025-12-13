"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const { error, data } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    // 이메일 인증을 강제하고 자동 로그인 방지
    await supabase.auth.signOut();
    if (!data.session) {
      setMessage("회원가입 완료! 이메일 인증 후 로그인해주세요.");
      router.push("/login?verify=1");
    } else {
      // (만약 이메일 인증이 비활성화된 프로젝트 설정일 경우)
      setMessage("회원가입 완료! 로그인하세요.");
      router.push("/login");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070a14] px-6">
      <div className="w-full max-w-md rounded-2xl border border-[--border] bg-[--card] p-6 text-white shadow-2xl backdrop-blur">
        <h1 className="text-2xl font-semibold">회원가입</h1>
        <p className="mt-1 text-sm text-[--muted]">이메일과 비밀번호로 계정을 만드세요.</p>

        <form onSubmit={handleSignup} className="mt-6 space-y-4">
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
            {loading ? "가입 중..." : "회원가입"}
          </button>
        </form>

        <div className="mt-4 text-sm text-[--muted]">
          이미 계정이 있나요?{" "}
          <Link href="/login" className="text-[#65f8ff] hover:underline">
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
