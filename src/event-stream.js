import { sanitizeSensitiveText } from "./sensitive-text.js";
import { awaitWithSignal } from "./response-lifetime.js";

export const DEFAULT_SSE_MAX_EVENT_BYTES = 256 * 1024;
export const DEFAULT_SSE_MAX_BUFFER_BYTES = 512 * 1024;

export class SwarmStreamError extends Error {
  constructor(details, cause) {
    super(details.message, { cause });
    this.name = "SwarmStreamError";
    this.code = details.code;
    this.lastEventId = details.last_event_id;
    this.lastReceivedEventId = details.last_received_event_id;
  }
}

export async function consumeEventStream(
  stream,
  onEvent,
  { onStreamError, strict = false, lastEventId = null,
    maxEventBytes = DEFAULT_SSE_MAX_EVENT_BYTES, maxBufferBytes = DEFAULT_SSE_MAX_BUFFER_BYTES, signal } = {}
) {
  if (strict && typeof onEvent !== "function") {
    throw new TypeError("Strict event consumption requires an application callback");
  }
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: strict });
  const eventLimit = Number.isFinite(maxEventBytes) && maxEventBytes > 0 ? maxEventBytes : DEFAULT_SSE_MAX_EVENT_BYTES;
  const bufferLimit = Number.isFinite(maxBufferBytes) && maxBufferBytes > 0 ? maxBufferBytes : DEFAULT_SSE_MAX_BUFFER_BYTES;
  let receivedId = lastEventId;
  let appliedId = lastEventId;
  let pendingId = lastEventId;
  let event = "message";
  let dataLines = [];
  let line = "";
  let lineHasChars = false;
  let frameBytes = 0;
  let dropping = false;
  let skipLF = false;
  let finished = false;

  const report = async (details, cause) => {
    const diagnostic = { ...details, last_event_id: appliedId, last_received_event_id: receivedId };
    const failure = new SwarmStreamError(diagnostic, cause);
    if (typeof onStreamError === "function" && !signal?.aborted) {
      try {
        await awaitWithSignal(() => onStreamError(diagnostic), signal);
      } catch (error) {
        if (!strict) throw error;
        throw new SwarmStreamError({ ...diagnostic, code: "error_callback_failed", message: "Swarm stream error callback failed" }, error);
      }
    }
    if (strict) throw failure;
  };

  const finishLine = async () => {
    if (lineHasChars) {
      if (!dropping && !line.startsWith(":")) {
        const separator = line.indexOf(":");
        const field = separator === -1 ? line : line.slice(0, separator);
        let value = separator === -1 ? "" : line.slice(separator + 1);
        if (value.startsWith(" ")) value = value.slice(1);
        if (field === "id" && !value.includes("\0")) pendingId = value;
        else if (field === "event") event = value || "message";
        else if (field === "data") dataLines.push(value);
      }
      line = "";
      lineHasChars = false;
      return;
    }

    // A cursor belongs to a complete frame, never to a truncated transport chunk.
    receivedId = pendingId;
    if (!dropping && dataLines.length > 0) {
      const rawData = dataLines.join("\n");
      let data = rawData;
      let valid = true;
      if (event === "audit_event" || event === "runtime_hint") {
        try {
          data = JSON.parse(rawData);
        } catch (error) {
          valid = false;
          await report({
            code: "invalid_json", id: receivedId, event,
            message: sanitizeSensitiveText(error.message || String(error)),
            raw_data: sanitizeSensitiveText(rawData, { maxLen: 256 })
          }, error);
        }
      }
      if (valid && typeof onEvent === "function") {
        try {
          await awaitWithSignal(() => onEvent(data, { id: receivedId, event }), signal);
        } catch (error) {
          if (signal?.aborted) {
            if (strict) await report({ code: "stream_cancelled", id: receivedId, event, message: "Swarm stream stopped before the event was applied" }, error);
            throw error;
          }
          if (!strict) throw error;
          await report({ code: "callback_failed", id: receivedId, event, message: "Swarm event application callback failed" }, error);
        }
        appliedId = receivedId;
      }
    }
    dataLines = [];
    event = "message";
    frameBytes = 0;
    dropping = false;
  };

  const consumeText = async (text) => {
    for (const char of text) {
      if (skipLF) {
        skipLF = false;
        if (char === "\n") continue;
      }
      const endOfLine = char === "\r" || char === "\n";
      if (!dropping) {
        const point = char.codePointAt(0);
        frameBytes += point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
        if (frameBytes > eventLimit || frameBytes > bufferLimit) {
          dropping = true;
          line = "";
          dataLines = [];
          await report({
            code: eventLimit <= bufferLimit ? "event_too_large" : "buffer_limit_exceeded",
            id: pendingId, event, event_bytes: frameBytes,
            message: "Skipped an oversized Swarm SSE event frame"
          });
        }
      }
      if (endOfLine) {
        await finishLine();
        skipLF = char === "\r";
      } else {
        lineHasChars = true;
        if (!dropping) line += char;
      }
    }
  };

  const decode = async (bytes, stream) => {
    let text;
    try {
      text = decoder.decode(bytes, { stream });
    } catch (error) {
      await report({ code: "invalid_utf8", message: "Swarm stream contains invalid UTF-8" }, error);
      return;
    }
    await consumeText(text);
  };

  try {
    while (true) {
      let chunk;
      try {
        chunk = await awaitWithSignal(() => reader.read(), signal);
      } catch (error) {
        if (!strict) throw error;
        await report({ code: "stream_read_failed", message: "Swarm event stream was interrupted" }, error);
      }
      if (chunk.done) {
        await decode(new Uint8Array(0), false);
        if (strict && (frameBytes > 0 || dropping)) {
          await report({ code: "truncated_frame", message: "Swarm stream ended before its event delimiter" });
        }
        finished = true;
        return strict ? appliedId : receivedId;
      }
      // Bound decoded working memory even when the transport provides a large chunk.
      for (let offset = 0; offset < chunk.value.byteLength; offset += 16384) {
        await decode(chunk.value.subarray(offset, offset + 16384), true);
      }
    }
  } finally {
    try {
      if (!finished) await reader.cancel();
    } catch {
      // Cleanup must not hide the original application or transport failure.
    } finally {
      reader.releaseLock();
    }
  }
}

export class StopConsumingEventStream extends Error {
  constructor(lastEventId = null) {
    super("Stop consuming Swarm event stream");
    this.name = "StopConsumingEventStream";
    this.lastEventId = lastEventId;
  }
}

export function createTimedAbortSignal(parentSignal, timeoutMs, reasonMessage = "Swarm request timed out") {
  const controller = new AbortController();
  let timeoutId = null;
  let abortedByParent = false;
  let parentAbortHandler = null;

  const abortWithReason = (reason) => {
    if (!controller.signal.aborted) {
      controller.abort(reason);
    }
  };

  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      abortWithReason(new Error(reasonMessage));
    }, timeoutMs);
  }

  if (parentSignal) {
    parentAbortHandler = () => {
      abortedByParent = true;
      abortWithReason(parentSignal.reason || new Error("Aborted"));
    };
    if (parentSignal.aborted) {
      parentAbortHandler();
    } else {
      parentSignal.addEventListener("abort", parentAbortHandler, { once: true });
    }
  }

  return {
    signal: controller.signal,
    abort: abortWithReason,
    stopTimeout() {
      if (timeoutId !== null) { clearTimeout(timeoutId); timeoutId = null; }
    },
    wasAbortedByParent() {
      return abortedByParent;
    },
    cleanup() {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      if (parentSignal && parentAbortHandler) {
        parentSignal.removeEventListener("abort", parentAbortHandler);
      }
    }
  };
}
