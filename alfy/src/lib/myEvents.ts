"use client";

// 幹事が作成したイベントの記憶(localStorage・この端末のみ)
// 管理トークンを保持し、ホームや回答ページから管理画面へ戻れるようにする。

export type MyEvent = {
  code: string;
  title: string;
  adminToken: string;
  createdAt: string; // ISO
};

const KEY = "alfy_my_events";

export function getMyEvents(): MyEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as MyEvent[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function addMyEvent(event: MyEvent): void {
  try {
    const list = getMyEvents().filter((e) => e.code !== event.code);
    list.unshift(event);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* localStorage不可の環境では諦める */
  }
}

export function getAdminToken(code: string): string | null {
  return getMyEvents().find((e) => e.code === code)?.adminToken ?? null;
}

export function removeMyEvent(code: string): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(getMyEvents().filter((e) => e.code !== code))
    );
  } catch {
    /* noop */
  }
}
