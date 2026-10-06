import { normalizeInput, parseTimeToken } from "./time";

export type ParsedCommand =
  | { intent: "START_ACTIVITY"; task: string; startAt: Date }
  | { intent: "END_ACTIVITY"; endAt: Date }
  | { intent: "ADD_COMPLETE_ACTIVITY"; task: string; startAt: Date; endAt: Date }
  | { intent: "UNKNOWN"; raw: string; reason?: string };

function tryStartAtSuffix(
  taskPart: string,
  reference: Date,
): { task: string; startAt: Date } | null {
  const en = taskPart.match(/^(.+?)\s+at\s+(.+)$/i);
  if (en) {
    const at = parseTimeToken(en[2], reference);
    if (at) return { task: en[1].trim(), startAt: at };
  }
  return null;
}

export function parseCommand(raw: string, referenceNow: Date): ParsedCommand {
  const text = normalizeInput(raw);
  if (!text) {
    return { intent: "UNKNOWN", raw, reason: "empty" };
  }

  const lower = text.toLowerCase();

  // --- END ---
  if (lower === "finish" || lower === "结束" || lower === "完成") {
    return { intent: "END_ACTIVITY", endAt: referenceNow };
  }

  // --- ADD COMPLETE (English) ---
  const enRecord = text.match(/^record\s+(.+?)\s+from\s+(.+?)\s+to\s+(.+)$/i);
  if (enRecord) {
    const startAt = parseTimeToken(enRecord[2], referenceNow);
    const endAt = parseTimeToken(enRecord[3], referenceNow);
    if (startAt && endAt) {
      return {
        intent: "ADD_COMPLETE_ACTIVITY",
        task: enRecord[1].trim(),
        startAt,
        endAt,
      };
    }
    return { intent: "UNKNOWN", raw, reason: "could not parse times in record" };
  }

  // --- ADD COMPLETE (Chinese) ---
  const cnRecord = text.match(/^记录\s*(.+?)\s*从\s*(.+?)\s*到\s*(.+?)(?:\s*点)?$/);
  if (cnRecord) {
    const startAt = parseTimeToken(cnRecord[2], referenceNow);
    let endToken = cnRecord[3].replace(/\s*点\s*$/, "");
    const endAt = parseTimeToken(endToken, referenceNow);
    if (startAt && endAt) {
      return {
        intent: "ADD_COMPLETE_ACTIVITY",
        task: cnRecord[1].trim(),
        startAt,
        endAt,
      };
    }
    return { intent: "UNKNOWN", raw, reason: "could not parse times in 记录" };
  }

  // --- START (English) ---
  const enStart = text.match(/^start\s+(.+)$/i);
  if (enStart) {
    const body = enStart[1].trim();
    const withAt = tryStartAtSuffix(body, referenceNow);
    if (withAt) {
      return {
        intent: "START_ACTIVITY",
        task: withAt.task,
        startAt: withAt.startAt,
      };
    }
    return {
      intent: "START_ACTIVITY",
      task: body,
      startAt: referenceNow,
    };
  }

  // --- START (Chinese): 12:15开始午餐 / 12点15分开始午餐 ---
  const cnTimeThenStart = text.match(/^(.+?)\s*开始\s*(.+)$/);
  if (cnTimeThenStart && !text.startsWith("开始")) {
    const at = parseTimeToken(cnTimeThenStart[1], referenceNow);
    if (at) {
      return {
        intent: "START_ACTIVITY",
        task: cnTimeThenStart[2].trim(),
        startAt: at,
      };
    }
  }

  // --- START (Chinese): 开始 XXX ---
  if (text.startsWith("开始")) {
    const body = text.slice(2).trim();
    if (body) {
      return {
        intent: "START_ACTIVITY",
        task: body,
        startAt: referenceNow,
      };
    }
  }

  return { intent: "UNKNOWN", raw, reason: "no matching pattern" };
}

export function describeCommand(
  cmd: ParsedCommand,
  formatTime: (d: Date) => string,
): { title: string; detail: string } {
  switch (cmd.intent) {
    case "START_ACTIVITY":
      return {
        title: "开始活动",
        detail: `开始「${cmd.task}」，开始于 ${formatTime(cmd.startAt)}`,
      };
    case "END_ACTIVITY":
      return {
        title: "结束活动",
        detail: `结束当前活动，结束于 ${formatTime(cmd.endAt)}`,
      };
    case "ADD_COMPLETE_ACTIVITY":
      return {
        title: "记录完整活动",
        detail: `记录「${cmd.task}」${formatTime(cmd.startAt)} – ${formatTime(cmd.endAt)}`,
      };
    default:
      return { title: "无法识别", detail: "请换一种说法或改用文字输入" };
  }
}
