"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PriceChart } from "@/components/PriceChart";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Alarm, CandlePoint, MarketType } from "@/lib/types";

type AlarmFormState = {
  symbol: string;
  targetPrice: string;
  direction: "above" | "below" | "cross";
  marketType: MarketType;
  note: string;
};

type SymbolSuggestion = { symbol: string; base?: string; quote?: string };

const marketOptions: { value: MarketType; label: string }[] = [
  { value: "spot", label: "현물" },
  { value: "futures", label: "선물" },
];

export default function Home() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [marketType, setMarketType] = useState<MarketType>("futures");
  const [price, setPrice] = useState<number | null>(null);
  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [interval, setInterval] = useState("5m");
  const [priceStatus, setPriceStatus] = useState<"idle" | "loading" | "error">("idle");
  const [alarmForm, setAlarmForm] = useState<AlarmFormState>({
    symbol: "BTCUSDT",
    targetPrice: "80000",
    direction: "cross",
    marketType: "futures",
    note: "",
  });
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedAlarmIds, setSelectedAlarmIds] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<SymbolSuggestion[]>([]);
  const [symbolsLoading, setSymbolsLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [chatId, setChatId] = useState("");
  const [chatStatus, setChatStatus] = useState<{ saved?: boolean; message?: string }>({});
  const [chatLoading, setChatLoading] = useState(false);
  const [repeat, setRepeat] = useState(false);

  const heroPrice = useMemo(
    () => (price ? `${price.toLocaleString()} USDT` : "가격 불러오는 중"),
    [price],
  );

  const refreshPrice = useCallback(async () => {
    const symbolQuery = symbol.trim().toUpperCase();
    if (symbolQuery.length < 3) {
      setPriceStatus("idle");
      setPrice(null);
      return;
    }
    setPriceStatus("loading");
    try {
      const res = await fetch(
        `/api/price?symbol=${encodeURIComponent(symbolQuery)}&type=${marketType}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setPriceStatus("error");
        setPrice(null);
        return;
      }
      setPrice(Number(data.price));
      setPriceStatus("idle");
    } catch (err) {
      console.error(err);
      setPriceStatus("error");
    }
  }, [symbol, marketType]);

  const refreshCandles = useCallback(async () => {
    const symbolQuery = symbol.trim().toUpperCase();
    if (symbolQuery.length < 3) {
      setCandles([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/candles?symbol=${encodeURIComponent(symbolQuery)}&type=${marketType}&interval=${interval}&limit=120`,
      );
      const data = await res.json();
      if (!res.ok) {
        setCandles([]);
        return;
      }
      setCandles(data.candles || []);
    } catch (err) {
      console.error(err);
      setCandles([]);
    }
  }, [symbol, marketType, interval]);

  const refreshAlarms = useCallback(async () => {
    try {
      const res = await fetch("/api/alarms");
      const data = await res.json();
      if (res.ok) {
        setAlarms(data.alarms || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    refreshPrice();
    refreshCandles();
  }, [refreshCandles, refreshPrice]);

  useEffect(() => {
    refreshAlarms();
  }, [refreshAlarms]);

  useEffect(() => {
    setSelectedAlarmIds((prev) => {
      if (prev.size === 0) return prev;
      const currentIds = new Set(alarms.map((a) => a.id));
      const next = new Set(Array.from(prev).filter((id) => currentIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [alarms]);

  const fetchChatId = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram/link");
      const data = await res.json();
      if (res.ok) {
        setChatId(data.chatId || "");
        setChatStatus({ saved: !!data.chatId, message: data.verified ? "연동됨" : "미검증" });
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchChatId();
  }, [fetchChatId]);

  // 티커 입력 시 심볼 추천
  useEffect(() => {
    const keyword = symbol.trim().toUpperCase();
    if (keyword.length < 2) {
      setSuggestions([]);
      return;
    }
    let aborted = false;
    setSymbolsLoading(true);
    fetch(`/api/symbols?q=${encodeURIComponent(keyword)}&type=${marketType}`)
      .then((res) => res.json())
      .then((data) => {
        if (aborted) return;
        setSuggestions(data.symbols || []);
      })
      .catch(() => {
        if (aborted) return;
        setSuggestions([]);
      })
      .finally(() => {
        if (!aborted) setSymbolsLoading(false);
      });

    return () => {
      aborted = true;
    };
  }, [symbol, marketType]);

  const handleCreateAlarm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    try {
      const res = await fetch("/api/alarms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...alarmForm,
          repeat,
          targetPrice: Number(alarmForm.targetPrice),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "알람을 만들 수 없습니다");
      setMessage("알람이 저장되었습니다.");
      setAlarmForm((prev) => ({ ...prev, note: "" }));
      refreshAlarms();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "알람 생성 중 오류");
    }
  };

  const toggleAlarm = async (alarm: Alarm) => {
    await fetch("/api/alarms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: alarm.id, active: !alarm.active }),
    });
    refreshAlarms();
  };

  const deleteAlarm = async (id: string) => {
    await fetch("/api/alarms", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    refreshAlarms();
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedAlarmIds(new Set());
  };

  const toggleSelectedAlarm = (id: string) => {
    setSelectedAlarmIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllAlarms = () => {
    setSelectedAlarmIds(new Set(alarms.map((a) => a.id)));
  };

  const clearSelection = () => {
    setSelectedAlarmIds(new Set());
  };

  const bulkDeleteSelected = async () => {
    const ids = Array.from(selectedAlarmIds);
    if (ids.length === 0) return;
    if (!confirm(`선택한 ${ids.length}개 알람을 삭제할까요?`)) return;

    await fetch("/api/alarms", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });

    exitSelectionMode();
    refreshAlarms();
  };

  const bulkSetActiveSelected = async (nextActive: boolean) => {
    const ids = Array.from(selectedAlarmIds);
    if (ids.length === 0) return;

    await fetch("/api/alarms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, active: nextActive }),
    });

    clearSelection();
    refreshAlarms();
  };

  const formLabel =
    alarmForm.direction === "above"
      ? "상승 돌파 알림"
      : alarmForm.direction === "below"
        ? "하락 돌파 알림"
        : "돌파 알림";

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
    router.push("/login");
  };

  const handleSaveChatId = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setChatLoading(true);
    setChatStatus({});
    try {
      const res = await fetch("/api/telegram/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "chat_id 저장 실패");
      setChatStatus({ saved: true, message: "저장되었습니다" });
    } catch (err) {
      setChatStatus({ saved: false, message: err instanceof Error ? err.message : "오류" });
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[--border] bg-[--card] px-3 py-1 text-xs text-[--muted] backdrop-blur">
              Next.js + Telegram + Binance
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              개인 맞춤형 코인 알람 대시보드
            </h1>
            <p className="max-w-2xl text-sm text-[--muted]">
              티커 입력 → 가격/캔들 조회 → 알람 설정 → 텔레그램으로 푸시. 크론 기반으로 가볍게
              동작하도록 스캐폴딩했습니다.
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-[--muted]">
              <span className="rounded-full border border-[--border] bg-[--card] px-3 py-1">
                현물/선물 지원
              </span>
              <span className="rounded-full border border-[--border] bg-[--card] px-3 py-1">
                Vercel Cron/Render Cron
              </span>
              <span className="rounded-full border border-[--border] bg-[--card] px-3 py-1">
                Supabase 연동 여지
              </span>
            </div>
          </div>
          <div className="w-full max-w-sm rounded-2xl border border-[--border] bg-[--card] p-4 shadow-lg backdrop-blur">
            <div className="text-xs text-[--muted]">현재가</div>
            <div className="mt-2 text-2xl font-semibold">{heroPrice}</div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-[--muted]">
              <div className="rounded-lg border border-[--border] bg-black/20 px-3 py-2">
                심볼
                <div className="text-base font-medium text-white">{symbol}</div>
              </div>
              <div className="rounded-lg border border-[--border] bg-black/20 px-3 py-2">
                시장
                <div className="text-base font-medium text-white">
                  {marketType === "spot" ? "현물" : "선물"}
                </div>
              </div>
            </div>
            {priceStatus === "error" && (
              <p className="mt-3 text-xs text-red-300">가격을 불러오지 못했습니다.</p>
            )}
            <button
              onClick={() => {
                refreshPrice();
                refreshCandles();
              }}
              className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15"
            >
              새로고침
            </button>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-[--border] bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
            >
              {signingOut ? "로그아웃 중..." : "로그아웃"}
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <section className="space-y-4 rounded-3xl border border-[--border] bg-[--card] p-6 shadow-2xl backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">티커 검색 · 알람 입력</h2>
                <p className="text-sm text-[--muted]">바이낸스 표기법으로 입력하세요.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-[--muted]">
                <span className="rounded-full border border-[--border] px-3 py-1">
                  예시: BTCUSDT
                </span>
                <span className="rounded-full border border-[--border] px-3 py-1">
                  예시: ETHUSDT
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
              <div className="rounded-2xl border border-[--border] bg-black/20 p-4">
                <label className="text-sm text-[--muted]">티커 (현물/선물)</label>
                <div className="mt-2 flex gap-2">
                  <input
                    value={symbol}
                    onChange={(e) => {
                      setSymbol(e.target.value.toUpperCase());
                      setAlarmForm((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }));
                    }}
                    className="w-full rounded-lg border border-[--border] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[--accent]"
                    placeholder="BTCUSDT"
                  />
                  <select
                    value={marketType}
                    onChange={(e) => {
                      const next = e.target.value as MarketType;
                      setMarketType(next);
                      setAlarmForm((prev) => ({ ...prev, marketType: next }));
                    }}
                    className="rounded-lg border border-[--border] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[--accent]"
                  >
                    {marketOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-2 text-xs text-[--muted]">
                  심볼 입력 시 가격/캔들이 갱신됩니다. 2자 이상 입력하면 검색 결과가 아래에 표시됩니다.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT", "DOGEUSDT"].map(
                    (sym) => (
                      <button
                        key={sym}
                        onClick={() => {
                          setSymbol(sym);
                          setAlarmForm((prev) => ({ ...prev, symbol: sym }));
                        }}
                        className="rounded-full border border-[--border] bg-white/5 px-3 py-1 text-xs text-white transition hover:bg-white/10"
                        type="button"
                      >
                        {sym}
                      </button>
                    ),
                  )}
                </div>
                <div className="mt-2 space-y-2">
                  {symbolsLoading && (
                    <div className="text-xs text-[--muted]">심볼 검색 중...</div>
                  )}
                  {!symbolsLoading && suggestions.length > 0 && (
                    <div className="rounded-xl border border-[--border] bg-black/30 p-2 text-xs text-white">
                      <div className="mb-1 text-[--muted]">검색 결과</div>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.map((s) => (
                          <button
                            key={s.symbol}
                            type="button"
                            onClick={() => {
                              setSymbol(s.symbol);
                              setAlarmForm((prev) => ({ ...prev, symbol: s.symbol }));
                              setSuggestions([]);
                            }}
                            className="rounded-lg border border-[--border] bg-white/5 px-3 py-1 text-xs transition hover:bg-white/10"
                            title={`${s.base ?? ""}${s.quote ? ` / ${s.quote}` : ""}`}
                          >
                            {s.symbol}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <form
                onSubmit={handleCreateAlarm}
                className="space-y-3 rounded-2xl border border-[--border] bg-black/20 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[--muted]">알람 조건</p>
                    <p className="text-base font-semibold text-white">{formLabel}</p>
                  </div>
                  <select
                    value={alarmForm.direction}
                    onChange={(e) =>
                      setAlarmForm((prev) => ({
                        ...prev,
                        direction: e.target.value as "above" | "below" | "cross",
                      }))
                    }
                  className="rounded-lg border border-[--border] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[--accent]"
                >
                  <option value="cross">돌파</option>
                  <option value="above">상승 돌파</option>
                  <option value="below">하락 돌파</option>
                </select>
                </div>

                <label className="text-xs text-[--muted]">목표가</label>
                <input
                  value={alarmForm.targetPrice}
                  onChange={(e) =>
                    setAlarmForm((prev) => ({ ...prev, targetPrice: e.target.value }))
                  }
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg border border-[--border] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[--accent]"
                  placeholder="80000"
                />

                <label className="text-xs text-[--muted]">메모 (선택)</label>
                <input
                  value={alarmForm.note}
                  onChange={(e) => setAlarmForm((prev) => ({ ...prev, note: e.target.value }))}
                  className="w-full rounded-lg border border-[--border] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[--accent]"
                  placeholder="텔레그램에서 보일 메모"
                />

                <label className="flex items-center gap-2 text-xs text-[--muted]">
                  <input
                    type="checkbox"
                    checked={repeat}
                    onChange={(e) => setRepeat(e.target.checked)}
                    className="h-4 w-4 rounded border-[--border] bg-black/30 accent-[--accent]"
                  />
                  반복 알림 (조건 충족 후에도 유지)
                </label>

                {message && <p className="text-xs text-[--muted]">{message}</p>}

                <button
                  type="submit"
                  className="w-full rounded-lg bg-gradient-to-r from-[#65f8ff] to-[#6ddcfe] px-4 py-2 text-sm font-semibold text-black transition hover:shadow-[0_8px_30px_rgba(101,248,255,0.35)]"
                >
                  알람 저장
                </button>
              </form>
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-[--border] bg-[--card] p-6 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">캔들 · 미니 시세</h2>
                <p className="text-sm text-[--muted]">TradingView lightweight-charts 기반.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-[--muted]">
                <select
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  className="rounded-lg border border-[--border] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[--accent]"
                >
                  <option value="5m">5분봉</option>
                  <option value="15m">15분봉</option>
                  <option value="1h">1시간봉</option>
                </select>
                <span className="hidden sm:inline">· {candles.length}개</span>
              </div>
            </div>
            <div className="rounded-2xl border border-[--border] bg-black/30 p-4">
              {candles.length ? (
                <PriceChart data={candles} />
              ) : (
                <div className="flex h-[260px] items-center justify-center text-sm text-[--muted]">
                  캔들을 불러오지 못했습니다.
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-[--muted]">
              <div className="rounded-xl border border-[--border] bg-black/20 p-3">
                최근 종가
                <div className="text-lg font-semibold text-white">
                  {candles.at(-1)?.close?.toLocaleString() ?? "-"}
                </div>
              </div>
              <div className="rounded-xl border border-[--border] bg-black/20 p-3">
                최근 저/고가
                <div className="text-lg font-semibold text-white">
                  {candles.length
                    ? `${candles.at(-1)?.low?.toLocaleString()} / ${candles
                        .at(-1)
                        ?.high?.toLocaleString()}`
                    : "-"}
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-[--border] bg-[--card] p-6 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">내 알람</h2>
              <p className="text-sm text-[--muted]">목록은 데모 스토어(인메모리) 기준입니다.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {!selectionMode ? (
                <button
                  type="button"
                  onClick={() => setSelectionMode(true)}
                  className="rounded-lg border border-[--border] bg-white/5 px-3 py-2 font-medium text-white transition hover:bg-white/10"
                >
                  선택
                </button>
              ) : (
                <>
                  <span className="text-xs text-[--muted]">선택 {selectedAlarmIds.size}개</span>
                  <button
                    type="button"
                    onClick={selectAllAlarms}
                    className="rounded-lg border border-[--border] bg-white/5 px-3 py-2 font-medium text-white transition hover:bg-white/10"
                  >
                    전체 선택
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded-lg border border-[--border] bg-white/5 px-3 py-2 font-medium text-white transition hover:bg-white/10"
                  >
                    선택 해제
                  </button>
                  <button
                    type="button"
                    onClick={() => bulkSetActiveSelected(true)}
                    disabled={selectedAlarmIds.size === 0}
                    className="rounded-lg border border-[--border] bg-white/5 px-3 py-2 font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
                  >
                    활성
                  </button>
                  <button
                    type="button"
                    onClick={() => bulkSetActiveSelected(false)}
                    disabled={selectedAlarmIds.size === 0}
                    className="rounded-lg border border-[--border] bg-white/5 px-3 py-2 font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
                  >
                    비활성
                  </button>
                  <button
                    type="button"
                    onClick={bulkDeleteSelected}
                    disabled={selectedAlarmIds.size === 0}
                    className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 font-medium text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    삭제
                  </button>
                  <button
                    type="button"
                    onClick={exitSelectionMode}
                    className="rounded-lg border border-[--border] bg-white/5 px-3 py-2 font-medium text-white transition hover:bg-white/10"
                  >
                    완료
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {alarms.map((alarm) => (
              <div
                key={alarm.id}
                className="flex flex-col gap-3 rounded-2xl border border-[--border] bg-black/30 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm text-[--muted]">
                      {alarm.marketType === "spot" ? "현물" : "선물"} ·{" "}
                      {alarm.direction === "cross"
                        ? "돌파"
                        : alarm.direction === "above"
                          ? "상승 돌파"
                          : "하락 돌파"}
                    </div>
                    <div className="text-lg font-semibold text-white">{alarm.symbol}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectionMode && (
                      <input
                        type="checkbox"
                        checked={selectedAlarmIds.has(alarm.id)}
                        onChange={() => toggleSelectedAlarm(alarm.id)}
                        className="h-4 w-4 rounded border-[--border] bg-black/30 accent-[--accent]"
                        aria-label="알람 선택"
                      />
                    )}
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        alarm.active
                          ? "bg-[#65f8ff]/20 text-[#65f8ff]"
                          : "bg-white/10 text-[--muted]"
                      }`}
                    >
                      {alarm.active ? "활성" : "비활성"}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-white">
                  목표가: <span className="font-semibold">{alarm.targetPrice.toLocaleString()}</span>
                </div>
                {alarm.note && <p className="text-xs text-[--muted]">메모: {alarm.note}</p>}
                {alarm.firedAt && (
                  <p className="text-xs text-amber-200">
                    최근 발송: {new Date(alarm.firedAt).toLocaleString()}
                  </p>
                )}
                {alarm.repeat && (
                  <p className="text-xs text-[--muted]">반복 알림 활성</p>
                )}
                <div className="flex gap-2 text-sm">
                  <button
                    onClick={() => toggleAlarm(alarm)}
                    disabled={selectionMode}
                    className="flex-1 rounded-lg border border-[--border] bg-white/10 px-3 py-2 font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
                  >
                    {alarm.active ? "일시정지" : "다시 켜기"}
                  </button>
                  <button
                    onClick={() => deleteAlarm(alarm.id)}
                    disabled={selectionMode}
                    className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
            {!alarms.length && (
              <div className="rounded-2xl border border-[--border] bg-black/20 p-6 text-sm text-[--muted]">
                아직 알람이 없습니다. 오른쪽 폼에서 추가하세요.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-[--border] bg-black/30 p-6 text-sm text-[--muted] backdrop-blur">
          <h3 className="text-lg font-semibold text-white">텔레그램/크론 연동 가이드</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-[--border] bg-black/30 p-4 space-y-3">
              <p className="font-medium text-white">1) 텔레그램 연동</p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>
                  텔레그램에서{" "}
                  <a
                    className="text-[#65f8ff]"
                    href="https://t.me/Coin_buza_bot"
                    target="_blank"
                    rel="noreferrer"
                  >
                    @Coin_buza_bot
                  </a>
                  에게 <code>/start</code> 입력 → 알람 수신 가능
                </li>
                <li>
                  텔레그램에서{" "}
                  <a
                    className="text-[#65f8ff]"
                    href="https://t.me/userinfobot"
                    target="_blank"
                    rel="noreferrer"
                  >
                    @userinfobot
                  </a>{" "}
                  에게 <code>/start</code> 입력 → 답변의 <code>chat_id</code> 확인
                </li>
                <li>
                  아래 입력창에 <code>chat_id</code> 붙여넣기 → 저장
                </li>
              </ol>
              <form onSubmit={handleSaveChatId} className="space-y-2">
                <input
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  className="w-full rounded-lg border border-[--border] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[--accent]"
                  placeholder="텔레그램 chat_id"
                />
                {chatStatus.message && (
                  <p className="text-xs" style={{ color: chatStatus.saved ? "#65f8ff" : "#fca5a5" }}>
                    {chatStatus.message}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={chatLoading}
                  className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-60"
                >
                  {chatLoading ? "저장 중..." : "chat_id 저장"}
                </button>
              </form>
            </div>
            <div className="rounded-2xl border border-[--border] bg-black/30 p-4">
              <p className="font-medium text-white">2) 크론</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Vercel Cron → <code>POST /api/cron/check-alarms</code></li>
                <li>최소 1분 주기로 등록 (5초 이하 불가)</li>
                <li>더 빠른 알림은 WebSocket 워커를 별도 런타임에 배치</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
