const responseSignals = new WeakMap();

export function responseLifetimeSignal(response, fallback) {
  return responseSignals.get(response) || fallback;
}

export function awaitWithSignal(operation, signal) {
  if (!signal) return Promise.resolve().then(operation);
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", abort);
    const abort = () => { cleanup(); reject(signal.reason); };
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(() => { signal.throwIfAborted(); return operation(); }).then(
      value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); }
    );
  });
}

export function streamTimeout(value, fallback, name) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 0 || value > 2147483647) throw new Error(`${name} must be an integer between 0 and 2147483647`);
  return value;
}

export function ownResponseLifetime(response, scope, { idleTimeoutMs = 0, totalTimeoutMs = 0 } = {}) {
  if (!response.body) { scope.cleanup(); return response; }
  const source = response.body;
  let reader;
  let controller;
  let closed = false;
  let idleTimer;
  let totalTimer;
  const clearTimers = () => { clearTimeout(idleTimer); clearTimeout(totalTimer); };
  const cancelSource = reason => {
    try { Promise.resolve((reader || source).cancel(reason)).catch(() => {}); } catch { /* Keep the primary failure. */ }
  };
  const release = () => {
    clearTimers();
    scope.signal.removeEventListener("abort", onAbort);
    scope.cleanup();
    try { reader?.releaseLock(); } catch { /* Already released or failed transport. */ }
  };
  const onAbort = () => {
    if (closed) return;
    closed = true;
    controller.error(scope.signal.reason);
    cancelSource(scope.signal.reason);
    release();
  };
  const body = new ReadableStream({
    start(value) {
      controller = value;
      scope.signal.addEventListener("abort", onAbort, { once: true });
      if (scope.signal.aborted) { onAbort(); return; }
      if (totalTimeoutMs) totalTimer = setTimeout(() => scope.abort(new Error("Swarm stream total timeout exceeded")), totalTimeoutMs);
    },
    async pull() {
      if (closed) return;
      try {
        reader ||= source.getReader();
        if (idleTimeoutMs) idleTimer = setTimeout(() => scope.abort(new Error("Swarm stream idle timeout exceeded")), idleTimeoutMs);
        const result = await reader.read();
        clearTimeout(idleTimer);
        if (closed) return;
        if (result.done) { closed = true; controller.close(); release(); }
        else controller.enqueue(result.value);
      } catch (error) {
        if (!closed) scope.abort(error);
      }
    },
    cancel(reason) {
      if (closed) return;
      closed = true;
      cancelSource(reason);
      release();
    }
  }, { highWaterMark: 0 });
  const owned = new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  responseSignals.set(owned, scope.signal);
  for (const key of ["url", "redirected", "type"]) {
    if (response[key] !== undefined) Object.defineProperty(owned, key, { value: response[key] });
  }
  return owned;
}
