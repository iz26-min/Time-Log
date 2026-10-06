"use client";

import { useCallback, useEffect, useState } from "react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useNow } from "@/hooks/useNow";
import {
  describeCommand,
  parseCommand,
  type ParsedCommand,
} from "@/lib/commandParser";
import {
  addCompleteActivity,
  finishActivity,
  getTodayState,
  isApiConfigured,
  startActivity,
} from "@/lib/api/sheetsClient";
import { isDuplicateSubmission, submissionKey } from "@/lib/dedupe";
import type { ActivityEntry, TodayState } from "@/lib/types";
import {
  formatDateDisplay,
  formatElapsed,
  formatTimeDisplay,
  parseISO,
  toHKISOString,
} from "@/lib/time";

type PendingConfirm = {
  raw: string;
  command: ParsedCommand;
};

type ActiveConflict = {
  active: ActivityEntry;
  pending: Extract<ParsedCommand, { intent: "START_ACTIVITY" }>;
};

export function TimeTrackerApp() {
  const now = useNow();
  const speech = useSpeechRecognition("zh-HK");

  const [state, setState] = useState<TodayState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textCommand, setTextCommand] = useState("");
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [conflict, setConflict] = useState<ActiveConflict | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fmtTime = useCallback((d: Date) => formatTimeDisplay(d), []);

  const refresh = useCallback(async () => {
    if (!isApiConfigured()) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const data = await getTodayState();
      setState(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (speech.status !== "processing" || !speech.transcript) return;
    openConfirm(speech.transcript);
    speech.clearTranscript();
  }, [speech.status, speech.transcript]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const openConfirm = (raw: string) => {
    const command = parseCommand(raw, now);
    if (command.intent === "UNKNOWN") {
      setError(`无法识别：「${raw}」。请尝试例如「开始早餐」或「Finish」。`);
      return;
    }
    setError(null);
    setPending({ raw, command });
  };

  const executeCommand = async (command: ParsedCommand) => {
    if (command.intent === "UNKNOWN") return;

    const key = submissionKey({
      intent: command.intent,
      task: "task" in command ? command.task : "",
      start:
        "startAt" in command ? toHKISOString(command.startAt) : undefined,
      end: "endAt" in command ? toHKISOString(command.endAt) : undefined,
    });
    if (isDuplicateSubmission(key)) {
      showToast("已忽略重复提交");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      let data: TodayState;
      switch (command.intent) {
        case "START_ACTIVITY":
          try {
            data = await startActivity({
              task: command.task,
              startAt: toHKISOString(command.startAt),
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : "";
            if (msg.startsWith("ACTIVE_CONFLICT:")) {
              const payload = JSON.parse(
                msg.slice("ACTIVE_CONFLICT:".length),
              ) as {
                active: ActivityEntry;
              };
              setConflict({
                active: payload.active,
                pending: command,
              });
              return;
            }
            throw e;
          }
          break;
        case "END_ACTIVITY":
          data = await finishActivity({
            endAt: toHKISOString(command.endAt),
          });
          break;
        case "ADD_COMPLETE_ACTIVITY":
          data = await addCompleteActivity({
            task: command.task,
            startAt: toHKISOString(command.startAt),
            endAt: toHKISOString(command.endAt),
          });
          break;
      }
      setState(data);
      showToast("已保存");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = async () => {
    if (!pending) return;
    const raw = pending.raw;
    setPending(null);
    const cmd = parseCommand(raw, new Date());
    if (cmd.intent === "UNKNOWN") {
      setError(`无法识别：「${raw}」`);
      return;
    }
    await executeCommand(cmd);
  };

  const onConflictResolve = async (finishPrevious: boolean) => {
    if (!conflict) return;
    const { active, pending: startCmd } = conflict;
    setConflict(null);
    if (!finishPrevious) return;

    setBusy(true);
    try {
      const data = await startActivity({
        task: startCmd.task,
        startAt: toHKISOString(startCmd.startAt),
        finishPreviousId: active.id,
      });
      setState(data);
      showToast("已保存");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const active = state?.active ?? null;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col gap-5 px-4 pb-10 pt-6">
      <header className="text-center">
        <p className="text-sm text-neutral-500">{formatDateDisplay(now)}</p>
        <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-neutral-900">
          {formatTimeDisplay(now)}
        </p>
      </header>

      {!isApiConfigured() && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          尚未连接 Google Sheet。请按{" "}
          <code className="text-xs">docs/SETUP.md</code> 完成 Apps Script
          部署，并在 Vercel 设置{" "}
          <code className="text-xs">NEXT_PUBLIC_SHEETS_API_URL</code>。
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          当前活动
        </p>
        {loading ? (
          <p className="mt-3 text-neutral-500">加载中…</p>
        ) : active ? (
          <>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">
              {active.task}
            </p>
            <p className="mt-1 text-neutral-600">
              开始于 {formatTimeDisplay(parseISO(active.startAt))}
            </p>
            <p className="mt-1 text-lg tabular-nums text-neutral-800">
              {formatElapsed(parseISO(active.startAt), now)} 进行中
            </p>
            <button
              type="button"
              disabled={busy || !isApiConfigured()}
              onClick={() => openConfirm("结束")}
              className="mt-4 w-full rounded-2xl bg-neutral-900 py-4 text-lg font-medium text-white active:scale-[0.99] disabled:opacity-40"
            >
              结束
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-lg text-neutral-600">暂无进行中的活动</p>
            <button
              type="button"
              disabled={busy || !isApiConfigured()}
              onClick={() => setTextCommand("开始 ")}
              className="mt-4 w-full rounded-2xl border border-neutral-300 py-4 text-lg font-medium text-neutral-900 active:scale-[0.99] disabled:opacity-40"
            >
              开始活动（输入指令）
            </button>
          </>
        )}
      </section>

      <section className="flex flex-col items-center gap-3">
        <button
          type="button"
          aria-label="语音输入"
          disabled={busy || !isApiConfigured()}
          onClick={() => {
            if (!speech.supported) {
              setError("此设备不支持语音识别，请使用下方文字输入。");
              return;
            }
            speech.start();
          }}
          className={`flex h-28 w-28 items-center justify-center rounded-full shadow-md transition active:scale-95 disabled:opacity-40 ${
            speech.status === "listening"
              ? "bg-red-500 text-white"
              : "bg-neutral-900 text-white"
          }`}
        >
          <MicIcon className="h-12 w-12" />
        </button>
        <p className="text-center text-sm text-neutral-600">
          {speech.supported
            ? speech.status === "listening"
              ? "正在聆听…"
              : "点击并说话"
            : "语音识别不可用 — 请使用文字输入"}
        </p>
        {speech.transcript && speech.status === "listening" && (
          <p className="text-center text-sm text-neutral-800">
            「{speech.transcript}」
          </p>
        )}
        {speech.errorMessage && (
          <p className="text-center text-xs text-neutral-500">
            {speech.errorMessage}
          </p>
        )}

        <form
          className="mt-2 w-full"
          onSubmit={(e) => {
            e.preventDefault();
            if (!textCommand.trim()) return;
            openConfirm(textCommand.trim());
            setTextCommand("");
          }}
        >
          <label className="sr-only" htmlFor="cmd">
            输入指令
          </label>
          <input
            id="cmd"
            value={textCommand}
            onChange={(e) => setTextCommand(e.target.value)}
            placeholder="或输入指令，例如：开始 breakfast / Finish"
            className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 placeholder:text-neutral-400"
            autoComplete="off"
            enterKeyHint="send"
          />
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
          今日记录
        </h2>
        {loading ? (
          <p className="text-neutral-500">加载中…</p>
        ) : !state?.entries.length ? (
          <p className="text-neutral-500">今天还没有记录。</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {state.entries.map((entry) => (
              <TimelineRow key={entry.id} entry={entry} now={now} />
            ))}
          </ul>
        )}
      </section>

      {pending && pending.command.intent !== "UNKNOWN" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
            <p className="text-xs font-medium uppercase text-neutral-400">
              你说
            </p>
            <p className="mt-1 text-lg text-neutral-900">「{pending.raw}」</p>
            <p className="mt-4 text-xs font-medium uppercase text-neutral-400">
              操作
            </p>
            <p className="mt-1 font-medium text-neutral-900">
              {describeCommand(pending.command, fmtTime).title}
            </p>
            <p className="mt-1 text-neutral-600">
              {describeCommand(pending.command, fmtTime).detail}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-2xl border border-neutral-300 py-3 font-medium"
                onClick={() => setPending(null)}
              >
                取消
              </button>
              <button
                type="button"
                disabled={busy}
                className="flex-1 rounded-2xl bg-neutral-900 py-3 font-medium text-white disabled:opacity-40"
                onClick={onConfirm}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {conflict && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
            <p className="text-lg font-medium text-neutral-900">
              「{conflict.active.task}」正在进行
            </p>
            <p className="mt-2 text-neutral-600">
              从 {formatTimeDisplay(parseISO(conflict.active.startAt))}{" "}
              开始。是否结束它并改为开始「{conflict.pending.task}」？
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                className="rounded-2xl bg-neutral-900 py-3 font-medium text-white disabled:opacity-40"
                onClick={() => onConflictResolve(true)}
              >
                结束并开始「{conflict.pending.task}」
              </button>
              <button
                type="button"
                className="rounded-2xl border border-neutral-300 py-3 font-medium"
                onClick={() => onConflictResolve(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function TimelineRow({ entry, now }: { entry: ActivityEntry; now: Date }) {
  const start = parseISO(entry.startAt);
  const end = entry.endAt ? parseISO(entry.endAt) : null;
  const range = end
    ? `${formatTimeDisplay(start)} – ${formatTimeDisplay(end)}`
    : `${formatTimeDisplay(start)} – 现在`;

  const duration =
    entry.durationMinutes ??
    (end ? null : formatElapsed(start, now));

  return (
    <li className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
      <p className="text-xs tabular-nums text-neutral-500">{range}</p>
      <p className="mt-1 font-medium text-neutral-900">{entry.task}</p>
      <p className="mt-0.5 text-sm tabular-nums text-neutral-600">
        {typeof duration === "number" ? `${duration} 分钟` : `${duration}`}
      </p>
    </li>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.71V21h2v-3.29A7 7 0 0 0 19 11h-2Z" />
    </svg>
  );
}
