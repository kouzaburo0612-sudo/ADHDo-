"use client";

import { useEffect, useRef, useState } from "react";

// 入力ドラフトの自動保存フック(要件C)
// - 変更のたびに sessionStorage へ自動保存(debounce 300ms)
// - マウント時に復元(ブラウザの戻る・進む・リロードで消えない)
// - clear() で明示破棄
export function useDraft<T>(
  key: string,
  initial: T
): {
  value: T;
  setValue: (v: T | ((prev: T) => T)) => void;
  clear: () => void;
  restored: boolean;
} {
  const [value, setValueState] = useState<T>(initial);
  const [restored, setRestored] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw != null) {
        setValueState({ ...initial, ...(JSON.parse(raw) as T) });
      }
    } catch {
      // 壊れたドラフトは無視して初期値で開始
    }
    setRestored(true);
    // key ごとに1回だけ復元する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setValue = (v: T | ((prev: T) => T)) => {
    setValueState((prev) => {
      const next = typeof v === "function" ? (v as (prev: T) => T)(prev) : v;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        try {
          sessionStorage.setItem(key, JSON.stringify(next));
        } catch {
          // 容量超過等は無視(入力は画面上には残る)
        }
      }, 300);
      return next;
    });
  };

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* noop */
    }
  };

  return { value, setValue, clear, restored };
}

// 幹事フローで使うドラフトキー(一括破棄用)
export const DRAFT_KEYS = {
  step1: "alfy_draft_step1",
  step2: "alfy_draft_step2",
  step2Images: "alfy_step2", // IndexedDB側のキー
  respond: (code: string) => `alfy_resp_${code}`,
} as const;
