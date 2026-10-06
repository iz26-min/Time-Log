"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

export function TimeTrackerApp() {
  const now = useNow();
  const speech = useSpeechRecognition("zh-HK");

  const [state, setState] = useState<TodayState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textCommand, setTextCommand] = useState("");
  const [confirmText, setConfirmText] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

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
    setError(null);
    setConfirmText(raw.trim());
  };

  const focusCommandInput = () => {
    const el = commandInputRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => el.focus(), 300);
  };

  const openCommandEditor = (initial: string) => {
    setError(null);
    setConfirmText(initial);
  };

  const executeCommand = async (command: ParsedCommand) => {
    if (command.intent === "UNKNOWN") return;

    const key = submissionKey({
      intent: command.intent,
      task: "task" in command ? command.task : "",
      hint:
        command.intent === "END_ACTIVITY" ? command.taskHint : undefined,
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
          data = await startActivity({
            task: command.task,
            startAt: toHKISOString(command.startAt),
          });
          break;
        case "END_ACTIVITY":
          data = await finishActivity({
            endAt: toHKISOString(command.endAt),
            taskHint: command.taskHint,
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
    if (!confirmText?.trim()) return;
    const raw = confirmText.trim();
    setConfirmText(null);
    const cmd = parseCommand(raw, new Date());
    if (cmd.intent === "UNKNOWN") {
      setError(`无法识别：「${raw}」。可改成例如「开始 写作业」或「结束」。`);
      setTextCommand(raw);
      focusCommandInput();
      return;
    }
    await executeCommand(cmd);
  };

  const confirmPreview = confirmText
    ? parseCommand(confirmText, new Date())
    : null;

  const actives =
    state?.actives ??
    state?.entries.filter((e) => !e.endAt) ??
    [];
  const active = actives[0] ?? state?.active ?? null;

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
        ) : actives.length > 0 ? (
          <>
            <p className="mt-2 text-xs text-neutral-500">
              最近开始（说「结束」会结束这一项）
            </p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">
              {active?.task}
            </p>
            {active && (
              <p className="mt-1 text-lg tabular-nums text-neutral-800">
                {formatElapsed(parseISO(active.startAt), now)} 进行中
              </p>
            )}
            {actives.length > 1 && (
              <ul className="mt-4 space-y-2 border-t border-neutral-100 pt-3">
                <p className="text-xs font-medium text-neutral-500">
                  同时进行（{actives.length} 项）
                </p>
                {actives.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="font-medium text-neutral-800">{a.task}</span>
                    <button
                      type="button"
                      disabled={busy || !isApiConfigured()}
                      onClick={() => openCommandEditor(`结束 ${a.task}`)}
                      className="shrink-0 rounded-lg border border-neutral-300 px-2 py-1 text-xs"
                    >
                      结束
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              disabled={busy || !isApiConfigured()}
              onClick={() => openConfirm("结束")}
              className="mt-4 w-full rounded-2xl bg-neutral-900 py-4 text-lg font-medium text-white active:scale-[0.99] disabled:opacity-40"
            >
              结束最近一项
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-lg text-neutral-600">暂无进行中的活动</p>
            <button
              type="button"
              disabled={busy || !isApiConfigured()}
              onClick={() => openCommandEditor("开始 ")}
              className="mt-4 w-full rounded-2xl border border-neutral-300 py-4 text-lg font-medium text-neutral-900 active:scale-[0.99] disabled:opacity-40"
            >
              开始活动（点这里输入文字）
            </button>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <form
          className="w-full"
          onSubmit={(e) => {
            e.preventDefault();
            if (!textCommand.trim()) return;
            openConfirm(textCommand.trim());
            setTextCommand("");
          }}
        >
          <label
            htmlFor="cmd"
            className="mb-2 block text-sm font-medium text-neutral-700"
          >
            输入指令（推荐，比语音更准确）
          </label>
          <input
            ref={commandInputRef}
            id="cmd"
            value={textCommand}
            onChange={(e) => setTextCommand(e.target.value)}
            placeholder="例如：开始 写作业 / 结束 / Finish"
            className="w-full rounded-2xl border-2 border-neutral-300 bg-white px-4 py-4 text-lg text-neutral-900 placeholder:text-neutral-400"
            autoComplete="off"
            enterKeyHint="done"
            disabled={busy || !isApiConfigured()}
          />
          <button
            type="submit"
            disabled={busy || !isApiConfigured() || !textCommand.trim()}
            className="mt-3 w-full rounded-2xl bg-neutral-900 py-4 text-lg font-medium text-white disabled:opacity-40"
          >
            提交指令
          </button>
        </form>

        <p className="text-center text-xs text-neutral-500">
          iPhone 上语音识别容易听错，建议优先打字；说完仍可在确认框里改字。
        </p>

        <div className="flex flex-col items-center gap-2 pt-2">
          <button
            type="button"
            aria-label="语音输入（可选）"
            disabled={busy || !isApiConfigured()}
            onClick={() => {
              if (!speech.supported) {
                setError("此浏览器不支持语音识别，请用上方文字框。");
                focusCommandInput();
                return;
              }
              speech.start();
            }}
            className={`flex h-20 w-20 items-center justify-center rounded-full shadow-md transition active:scale-95 disabled:opacity-40 ${
              speech.status === "listening"
                ? "bg-red-500 text-white"
                : "border-2 border-neutral-300 bg-white text-neutral-800"
            }`}
          >
            <MicIcon className="h-10 w-10" />
          </button>
          <p className="text-center text-sm text-neutral-600">
            {speech.supported
              ? speech.status === "listening"
                ? "正在聆听…"
                : "可选：语音输入"
              : "语音不可用"}
          </p>
          {speech.transcript && speech.status === "listening" && (
            <p className="text-center text-sm text-neutral-800">
              「{speech.transcript}」
            </p>
          )}
        </div>
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

      {confirmText !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
            <p className="text-xs font-medium uppercase text-neutral-400">
              指令（可修改）
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-2 w-full rounded-xl border-2 border-neutral-400 px-3 py-4 text-lg"
              autoFocus
              inputMode="text"
              enterKeyHint="done"
            />
            <p className="mt-4 text-xs font-medium uppercase text-neutral-400">
              操作预览
            </p>
            {confirmPreview && confirmPreview.intent !== "UNKNOWN" ? (
              <>
                <p className="mt-1 font-medium text-neutral-900">
                  {describeCommand(confirmPreview, fmtTime).title}
                </p>
                <p className="mt-1 text-neutral-600">
                  {describeCommand(confirmPreview, fmtTime).detail}
                </p>
              </>
            ) : (
              <p className="mt-1 text-amber-800">
                暂时无法识别，请改成例如「开始 写作业」或「结束」。
              </p>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-2xl border border-neutral-300 py-3 font-medium"
                onClick={() => setConfirmText(null)}
              >
                取消
              </button>
              <button
                type="button"
                disabled={
                  busy ||
                  !isApiConfigured() ||
                  !confirmText.trim() ||
                  !confirmPreview ||
                  confirmPreview.intent === "UNKNOWN"
                }
                className="flex-1 rounded-2xl bg-neutral-900 py-3 font-medium text-white disabled:opacity-40"
                onClick={onConfirm}
              >
                确认
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
