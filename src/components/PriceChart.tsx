"use client";

import { useEffect, useRef } from "react";
import type { IChartApi } from "lightweight-charts";
import { CandlePoint } from "@/lib/types";

type Props = {
  data: CandlePoint[];
  height?: number;
};

// lightweight-charts는 DOM이 필요한 라이브러리라 클라이언트 사이드에서만 동적 로드한다.
export function PriceChart({ data, height = 260 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    let cleanup = () => {};
    const init = async () => {
      const container = containerRef.current;
      if (!container) return;

      // StrictMode에서 effect가 두 번 호출될 수 있으므로 기존 차트를 정리한다.
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      container.innerHTML = "";

      const { createChart, ColorType } = await import("lightweight-charts");
      const chart = createChart(container, {
        height,
        width: container.clientWidth,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#c6d5ff",
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.04)" },
          horzLines: { color: "rgba(255,255,255,0.04)" },
        },
        timeScale: {
          borderVisible: false,
          fixLeftEdge: true,
          fixRightEdge: true,
          timeVisible: true, // 5분봉에서도 시:분 노출
          secondsVisible: false,
        },
        rightPriceScale: { borderVisible: false },
        handleScale: false,
      });

      const typedChart = chart as unknown as IChartApi;
      if (typeof typedChart.addCandlestickSeries !== "function") {
        console.error("addCandlestickSeries is not available on chart instance");
        return;
      }
      chartRef.current = typedChart;

      const series = typedChart.addCandlestickSeries({
        upColor: "#6fffe9",
        downColor: "#ff7d9c",
        borderUpColor: "#6fffe9",
        borderDownColor: "#ff7d9c",
        wickUpColor: "#6fffe9",
        wickDownColor: "#ff7d9c",
      });

      if (data.length) {
        series.setData(
          data.map((candle) => ({
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          })),
        );
      }

      const onResize = () => {
        typedChart.applyOptions({ width: container.clientWidth });
      };
      window.addEventListener("resize", onResize);

      cleanup = () => {
        window.removeEventListener("resize", onResize);
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
        container.innerHTML = "";
      };
    };

    init();
    return () => cleanup();
  }, [data, height]);

  return <div ref={containerRef} className="w-full" />;
}
