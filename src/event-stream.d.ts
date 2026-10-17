import type { SwarmRequestOptions } from "./types.js";

export interface SwarmStreamDiagnostic {
  code: string;
  message: string;
  last_event_id: string | null;
  last_received_event_id: string | null;
  id?: string | null;
  event?: string;
  event_bytes?: number;
  raw_data?: string;
}

export interface SwarmStreamOptions extends SwarmRequestOptions {
  lastEventId?: string;
  /** Stop on malformed, incomplete or unapplied events. Does not guarantee a complete audit log. */
  strict?: boolean;
  onStreamError?: (details: SwarmStreamDiagnostic) => Promise<void> | void;
  sseMaxEventBytes?: number;
  sseMaxBufferBytes?: number;
}

export class SwarmStreamError extends Error {
  constructor(details: SwarmStreamDiagnostic, cause?: unknown);
  code: string;
  /** Last cursor whose application callback completed successfully. */
  lastEventId: string | null;
  lastReceivedEventId: string | null;
}
