// 確定日程の .ics 生成(サーバー側で生成しダウンロード配布 — 仕様書 §1)

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildIcs(params: {
  uid: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string | null; // HH:MM:SS | null(終日)
  endTime: string | null;
  url: string;
}): string {
  const [y, m, d] = params.date.split("-").map(Number);
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  let dtstart: string;
  let dtend: string;
  if (params.startTime) {
    const [sh, sm] = params.startTime.split(":").map(Number);
    const [eh, em] = (params.endTime ?? params.startTime).split(":").map(Number);
    // JSTのローカル時刻としてTZID付きで出力
    dtstart = `DTSTART;TZID=Asia/Tokyo:${y}${pad(m)}${pad(d)}T${pad(sh)}${pad(sm)}00`;
    dtend = `DTEND;TZID=Asia/Tokyo:${y}${pad(m)}${pad(d)}T${pad(eh)}${pad(em)}00`;
  } else {
    // 終日イベント
    const next = new Date(Date.UTC(y, m - 1, d));
    next.setUTCDate(next.getUTCDate() + 1);
    dtstart = `DTSTART;VALUE=DATE:${y}${pad(m)}${pad(d)}`;
    dtend = `DTEND;VALUE=DATE:${next.getUTCFullYear()}${pad(next.getUTCMonth() + 1)}${pad(next.getUTCDate())}`;
  }

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Alfy//Scheduler//JA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${params.uid}@alfy`,
    `DTSTAMP:${dtstamp}`,
    dtstart,
    dtend,
    `SUMMARY:${escapeText(params.title)}`,
    `URL:${params.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
