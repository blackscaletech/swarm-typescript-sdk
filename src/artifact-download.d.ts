import type { SwarmRequestOptions } from "./types.js";

export interface ArtifactContent {
  artifact_id: string;
  media_type: string;
  sha256: string;
  size_bytes: number;
  body: string;
}

export interface VerifiedArtifactDownload {
  artifact_id: string;
  media_type: string | null;
  sha256: string;
  size_bytes: number;
  bytes: Uint8Array & { readonly buffer: ArrayBuffer };
}

export interface ArtifactDownloadOptions extends SwarmRequestOptions {
  expectedSha256?: string;
  maxArtifactBytes?: number;
  downloadTimeoutMs?: number;
}
