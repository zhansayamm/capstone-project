export function debugLog(message: string, data?: unknown) {
  if (!import.meta.env.DEV) return;
  if (typeof data === "undefined") {
    console.log(message);
    return;
  }
  console.log(message, data);
}

export function debugError(message: string, error?: unknown) {
  if (!import.meta.env.DEV) return;
  console.error(message, error);
}

