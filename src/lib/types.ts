export type ActivityEntry = {
  /** Internal row reference (not stored in sheet). */
  id: string;
  date: string;
  task: string;
  startAt: string;
  endAt: string | null;
  durationMinutes: number | null;
  notes: string;
};

export type TodayState = {
  today: string;
  timezone: string;
  /** Most recently started open activity (stack top). */
  active: ActivityEntry | null;
  /** All open activities today, newest first. */
  actives: ActivityEntry[];
  entries: ActivityEntry[];
};

export type ApiAction =
  | { action: "getTodayState" }
  | {
      action: "startActivity";
      task: string;
      startAt: string;
      finishPreviousId?: string;
    }
  | { action: "finishActivity"; id?: string; endAt: string; taskHint?: string }
  | {
      action: "addCompleteActivity";
      task: string;
      startAt: string;
      endAt: string;
    };

export type ApiError = { ok: false; error: string };
export type ApiSuccess<T> = { ok: true; data: T };
