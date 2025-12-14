"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Step = "email" | "otp" | "password";

export default function SignupPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const sendOtp = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) throw new Error("이메일을 입력해주세요.");

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
  };

  const verifyOtp = async () => {
    const normalizedEmail = email.trim();
    const token = otp.trim();
    if (!token) throw new Error("인증 코드를 입력해주세요.");

    const first = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token,
      type: "signup",
    });
    if (!first.error) return;

    const fallback = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token,
      type: "magiclink",
    });
    if (fallback.error) throw first.error;
  };

  const setUserPassword = async () => {
    if (!password) throw new Error("비밀번호를 입력해주세요.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  };

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await sendOtp();
      setStep("otp");
      setMessage("인증 코드를 보냈습니다. 이메일을 확인해주세요.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "인증 코드 발송 실패");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await verifyOtp();
      setStep("password");
      setMessage("인증 완료! 비밀번호를 설정해주세요.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "인증 실패");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await setUserPassword();
      router.push("/");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "비밀번호 설정 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070a14] px-6">
      <div className="w-full max-w-md rounded-2xl border border-[--border] bg-[--card] p-6 text-white shadow-2xl backdrop-blur">
        <h1 className="text-2xl font-semibold">회원가입</h1>
        <p className="mt-1 text-sm text-[--muted]">이메일 OTP 인증 후 비밀번호를 설정합니다.</p>

        {step === "email" && (
          <form onSubmit={handleSendOtp} className="mt-6 space-y-4">
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

            {message && <p className="text-sm text-red-300">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-[#65f8ff] to-[#6ddcfe] px-4 py-2 text-sm font-semibold text-black transition hover:shadow-[0_8px_30px_rgba(101,248,255,0.35)] disabled:opacity-60"
            >
              {loading ? "전송 중.." : "인증 코드 받기"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
            <p className="text-xs text-[--muted]">{email}로 인증 코드를 보냈습니다.</p>

            <div>
              <label className="text-sm text-[--muted]">인증 코드</label>
              <input
                className="mt-1 w-full rounded-lg border border-[--border] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[--accent]"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6자리"
                required
              />
            </div>

            {message && <p className="text-sm text-red-300">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-[#65f8ff] to-[#6ddcfe] px-4 py-2 text-sm font-semibold text-black transition hover:shadow-[0_8px_30px_rgba(101,248,255,0.35)] disabled:opacity-60"
            >
              {loading ? "확인 중.." : "인증 완료"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setOtp("");
                  setMessage("");
                  setStep("email");
                }}
                className="text-[--muted] hover:underline"
              >
                이메일 변경
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  setMessage("");
                  try {
                    await sendOtp();
                    setMessage("인증 코드를 다시 보냈습니다.");
                  } catch (err) {
                    setMessage(err instanceof Error ? err.message : "재전송 실패");
                  } finally {
                    setLoading(false);
                  }
                }}
                className="text-[#65f8ff] hover:underline disabled:opacity-60"
              >
                코드 재전송
              </button>
            </div>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={handleSetPassword} className="mt-6 space-y-4">
            <p className="text-xs text-[--muted]">비밀번호는 로그인에 사용됩니다.</p>

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
              {loading ? "설정 중.." : "가입 완료"}
            </button>
          </form>
        )}

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

