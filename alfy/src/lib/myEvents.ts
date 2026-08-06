"use client";

// 自分が関わったイベントの記憶(localStorage・この端末のみ)
// 幹事(organizer): 管理トークンを保持し管理画面へ戻れるようにする
// 参加者(participant): 回答したイベントの履歴としてホームに表示する

export type MyEventRole = "organizer" | "participant";

export type MyEvent = {
  code: string;
  title: string;
  role: MyEventRole;
  adminToken?: string; // 幹事のみ
  updatedAt: string; // ISO
};

const KEY = "alfy_my_events";

type LegacyEvent = {
  code?: string;
  title?: string;
  adminToken?: string;
  createdAt?: string;
  role?: MyEventRole;
  updatedAt?: string;
};

function normalize(raw: LegacyEvent): MyEvent | null {
  if (!raw || typeof raw.code !== "string") return null;
  return {
    code: raw.code,
    title: raw.title ?? "",
    role: raw.role ?? (raw.adminToken ? "organizer" : "participant"),
    adminToken: raw.adminToken,
    updatedAt: raw.updatedAt ?? raw.createdAt ?? new Date().toISOString(),
  };
}

export function getMyEvents(): MyEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as LegacyEvent[];
    if (!Array.isArray(list)) return [];
    return list
      .map(normalize)
      .filter((e): e is MyEvent => e !== null)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  } catch {
    return [];
  }
}

function save(list: MyEvent[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* localStorage不可の環境では諦める */
  }
}

export function upsertMyEvent(event: {
  code: string;
  title: string;
  role: MyEventRole;
  adminToken?: string;
}): void {
  const list = getMyEvents();
  const existing = list.find((e) => e.code === event.code);
  const merged: MyEvent = {
    code: event.code,
    title: event.title || existing?.title || "",
    // 幹事情報は participant で上書きしない
    role: existing?.role === "organizer" ? "organizer" : event.role,
    adminToken: event.adminToken ?? existing?.adminToken,
    updatedAt: new Date().toISOString(),
  };
  save([merged, ...list.filter((e) => e.code !== event.code)]);
}

export function getAdminToken(code: string): string | null {
  return getMyEvents().find((e) => e.code === code)?.adminToken ?? null;
}

export function removeMyEvent(code: string): void {
  save(getMyEvents().filter((e) => e.code !== code));
}
