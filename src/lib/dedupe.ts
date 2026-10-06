const WINDOW_MS = 5000;

let lastKey = "";
let lastAt = 0;

export function submissionKey(parts: Record<string, string | undefined>): string {
  return Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k] ?? ""}`)
    .join("|");
}

export function isDuplicateSubmission(key: string): boolean {
  const now = Date.now();
  if (key === lastKey && now - lastAt < WINDOW_MS) {
    return true;
  }
  lastKey = key;
  lastAt = now;
  return false;
}

export function resetDedupeForTests(): void {
  lastKey = "";
  lastAt = 0;
}
