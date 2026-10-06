export type ActivityEntry = {
  id: string;
  date: string;
  task: string;
  startAt: string;
  endAt: string | null;
  durationMinutes: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type TodayState = {
  today: string;
  timezone: string;
  active: ActivityEntry | null;
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
  | { action: "finishActivity"; id?: string; endAt: string }
  | {
      action: "addCompleteActivity";
      task: string;
      startAt: string;
      endAt: string;
    };

export type ApiError = { ok: false; error: string };
export type ApiSuccess<T> = { ok: true; data: T };
