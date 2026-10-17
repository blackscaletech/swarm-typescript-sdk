export function sleep(delayMs, signal) {
  if (!delayMs || delayMs <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason || new Error("Aborted"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function linkedAbortController(signal) {
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal.reason || new Error("Aborted"));
  if (signal?.aborted) {
    onAbort();
  } else {
    signal?.addEventListener("abort", onAbort, { once: true });
  }
  return {
    controller,
    cleanup() {
      signal?.removeEventListener("abort", onAbort);
    }
  };
}

export function computeLoopDelayMs(failureCount, baseMs, randomValue = Math.random()) {
  const base = Math.max(250, Number(baseMs) || 3000);
  const exponent = Math.min(Math.max(0, Number(failureCount) || 0), 6);
  const ceiling = Math.min(30_000, base * 2 ** exponent);
  const random = Math.min(1, Math.max(0, Number.isFinite(randomValue) ? randomValue : 0.5));
  return Math.floor(ceiling * (0.75 + random * 0.25));
}
