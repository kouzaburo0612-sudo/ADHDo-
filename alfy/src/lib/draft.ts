// 作成フローの下書き(STEP1 → STEP2 の受け渡し。sessionStorage 使用)

export type EventDraft = {
  title: string;
  durationMinutes: number | null; // null = 終日
  maxCandidates: number | null; // null = できるだけ
  deadline: string | null;
  candidateDates: string[]; // カレンダーで選んだ候補日(空 = 制限なし)
  timeFrom: string | null;
  timeTo: string | null;
  ngWeekdays: number[]; // 0=日〜6=土(要件A)
  memo: string; // 参加者に伝えるメモ(任意)
};

const KEY = "alfy_event_draft";

export function saveDraft(draft: EventDraft): void {
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function loadDraft(): EventDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EventDraft>;
    if (typeof parsed.title !== "string") return null;
    return {
      title: parsed.title,
      durationMinutes: parsed.durationMinutes ?? null,
      maxCandidates: parsed.maxCandidates ?? null,
      deadline: parsed.deadline ?? null,
      candidateDates: parsed.candidateDates ?? [],
      timeFrom: parsed.timeFrom ?? null,
      timeTo: parsed.timeTo ?? null,
      ngWeekdays: parsed.ngWeekdays ?? [],
      memo: parsed.memo ?? "",
    };
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  sessionStorage.removeItem(KEY);
}
