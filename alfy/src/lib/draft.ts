// 作成フローの下書き(STEP1 → STEP2 の受け渡し。sessionStorage 使用)

export type EventDraft = {
  title: string;
  durationMinutes: number | null; // null = 終日
  maxCandidates: number | null; // null = できるだけ
  deadline: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  timeFrom: string | null;
  timeTo: string | null;
};

const KEY = "alfy_event_draft";

export function saveDraft(draft: EventDraft): void {
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function loadDraft(): EventDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EventDraft;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  sessionStorage.removeItem(KEY);
}
