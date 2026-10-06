import type { ApiAction, ApiError, ApiSuccess, TodayState } from "../types";

function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SHEETS_API_URL?.trim();
  if (!url) {
    throw new Error(
      "未配置 NEXT_PUBLIC_SHEETS_API_URL。请在 Vercel 或 .env.local 中设置 Google Apps Script Web App 地址。",
    );
  }
  return url.replace(/\/$/, "");
}

async function callApi<T>(payload: ApiAction): Promise<T> {
  const url = getBaseUrl();

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await res.text();
  let json: ApiSuccess<T> | ApiError;
  try {
    json = JSON.parse(text) as ApiSuccess<T> | ApiError;
  } catch {
    throw new Error(
      `服务器返回了无法解析的内容（HTTP ${res.status}）。请确认 Apps Script 已部署为 Web App。`,
    );
  }

  if (!json.ok) {
    throw new Error(json.error || "请求失败");
  }

  return json.data;
}

export function isApiConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SHEETS_API_URL?.trim());
}

export async function getTodayState(): Promise<TodayState> {
  return callApi<TodayState>({ action: "getTodayState" });
}

export async function startActivity(params: {
  task: string;
  startAt: string;
  finishPreviousId?: string;
}): Promise<TodayState> {
  return callApi<TodayState>({
    action: "startActivity",
    task: params.task,
    startAt: params.startAt,
    finishPreviousId: params.finishPreviousId,
  });
}

export async function finishActivity(params: {
  id?: string;
  endAt: string;
}): Promise<TodayState> {
  return callApi<TodayState>({
    action: "finishActivity",
    id: params.id,
    endAt: params.endAt,
  });
}

export async function addCompleteActivity(params: {
  task: string;
  startAt: string;
  endAt: string;
}): Promise<TodayState> {
  return callApi<TodayState>({
    action: "addCompleteActivity",
    task: params.task,
    startAt: params.startAt,
    endAt: params.endAt,
  });
}
