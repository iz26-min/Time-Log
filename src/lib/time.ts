/** Hong Kong timezone helpers for display and ISO serialization. */

export const TZ = "Asia/Hong_Kong";

const isoDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFmt12 = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const timeFmt24 = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function hkCalendarDate(d: Date): string {
  return isoDateFmt.format(d);
}

export function formatTimeDisplay(d: Date, use24h = false): string {
  return use24h ? timeFmt24.format(d) : timeFmt12.format(d);
}

export function formatDateDisplay(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

/** Offset +08:00 ISO string without sub-second precision. */
export function toHKISOString(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  const y = get("year");
  const mo = get("month");
  const da = get("day");
  const h = get("hour");
  const mi = get("minute");
  const s = get("second");
  return `${y}-${mo}-${da}T${h}:${mi}:${s}+08:00`;
}

function hkYmdHms(d: Date): {
  y: number;
  mo: number;
  da: number;
  h: number;
  mi: number;
  s: number;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const n = (type: Intl.DateTimeFormatPartTypes) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

  return {
    y: n("year"),
    mo: n("month"),
    da: n("day"),
    h: n("hour"),
    mi: n("minute"),
    s: n("second"),
  };
}

/** Build a Date for an instant that displays as the given HK local wall time. */
export function hkLocalToDate(
  y: number,
  mo: number,
  da: number,
  h: number,
  mi: number,
  s = 0,
): Date {
  const utcGuess = Date.UTC(y, mo - 1, da, h - 8, mi, s);
  let d = new Date(utcGuess);
  for (let i = 0; i < 3; i++) {
    const p = hkYmdHms(d);
    const target = Date.UTC(y, mo - 1, da, h, mi, s);
    const actual = Date.UTC(p.y, p.mo - 1, p.da, p.h, p.mi, p.s);
    d = new Date(d.getTime() + (target - actual));
  }
  return d;
}

export function todayHKStartEnd(reference: Date): { start: Date; end: Date } {
  const { y, mo, da } = hkYmdHms(reference);
  const start = hkLocalToDate(y, mo, da, 0, 0, 0);
  const end = hkLocalToDate(y, mo, da, 23, 59, 59);
  return { start, end };
}

export function normalizeInput(s: string): string {
  return s
    .trim()
    .replace(/\u3000/g, " ")
    .replace(/[：]/g, ":")
    .replace(/\s+/g, " ")
    .replace(/[。．，,.!！?？]+$/g, "");
}

/**
 * Parse a simple time token against reference "today" in HK.
 * Supports: 15:20, 3:20, 3:20pm, 15:20:00, 12点15分, 12点, 下午3点20
 */
export function parseTimeToken(token: string, reference: Date): Date | null {
  const t = normalizeInput(token).toLowerCase();
  if (!t) return null;

  const { y, mo, da } = hkYmdHms(reference);
  let h: number | null = null;
  let mi = 0;

  const ampm = t.match(
    /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)$/,
  );
  if (ampm) {
    h = parseInt(ampm[1], 10);
    mi = ampm[2] ? parseInt(ampm[2], 10) : 0;
    const p = ampm[3].startsWith("p");
    if (p && h < 12) h += 12;
    if (!p && h === 12) h = 0;
    return hkLocalToDate(y, mo, da, h, mi, 0);
  }

  const colon = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (colon) {
    h = parseInt(colon[1], 10);
    mi = parseInt(colon[2], 10);
    if (h >= 24 || mi >= 60) return null;
    return hkLocalToDate(y, mo, da, h, mi, 0);
  }

  const cnPm = t.match(/^(上午|下午|中午|晚上)?(\d{1,2})点(?:(\d{1,2})分?)?$/);
  if (cnPm) {
    h = parseInt(cnPm[2], 10);
    mi = cnPm[3] ? parseInt(cnPm[3], 10) : 0;
    const period = cnPm[1];
    if (period === "下午" || period === "晚上") {
      if (h < 12) h += 12;
    } else if (period === "中午" && h <= 1) {
      h = 12;
    } else if (!period && h <= 6) {
      // bare hour 1-6 → likely PM for time logging
      h += 12;
    }
    return hkLocalToDate(y, mo, da, h, mi, 0);
  }

  return null;
}

export function durationMinutes(start: Date, end: Date): number {
  let endAdj = end.getTime();
  const startMs = start.getTime();
  if (endAdj < startMs) {
    endAdj += 24 * 60 * 60 * 1000;
  }
  return Math.round((endAdj - startMs) / 60000);
}

export function formatElapsed(start: Date, now: Date): string {
  const mins = durationMinutes(start, now);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function parseISO(iso: string): Date {
  return new Date(iso);
}
