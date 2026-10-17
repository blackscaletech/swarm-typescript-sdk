import { SwarmClient, type ArtifactDownloadOptions, type VerifiedArtifactDownload } from "../src/index.js";

const client = new SwarmClient({ baseUrl: "https://example.invalid" });
const options: ArtifactDownloadOptions = { expectedSha256: "0".repeat(64), maxArtifactBytes: 1024, downloadTimeoutMs: 5000 };
const result: Promise<VerifiedArtifactDownload> = client.downloadArtifact("art_test", options);
result.then(download => {
  const bytes: Uint8Array = download.bytes;
  const media: string | null = download.media_type;
  void bytes;
  void media;
  new Blob([download.bytes], { type: download.media_type ?? "application/octet-stream" });
  void crypto.subtle.digest("SHA-256", download.bytes);
});
// @ts-expect-error Artifact identifiers must be strings.
client.downloadArtifact(123);
// @ts-expect-error Download deadlines are milliseconds, not text.
client.downloadArtifact("art_test", { downloadTimeoutMs: "5000" });
