import { SwarmClient, type ContextSourceMetadata } from "../src/index.js";

const client = new SwarmClient({ baseUrl: "https://swarm.example" });
const pack = await client.buildSpaceContextPack("space", { query: "Existing evidence" });
const captureIdentity: string | undefined = pack.context_identity;
const coverage: "complete_for_declared_scope" | "partial" | "unknown" | undefined = pack.coverage?.status;
void [captureIdentity, coverage];
const plan = await client.getContextPlan("space", { composer_text: "Review the evidence" });
const metadata: ContextSourceMetadata[] = [...pack.items, ...plan.included_refs];
for (const source of metadata) {
  const version: string | undefined = source.source_version;
  const descriptor: string | undefined = source.source_binding_hash;
  const excerpt: string | undefined = source.excerpt_hash;
  const previewOnly: boolean | undefined = source.excerpt_only;
  const required: boolean | undefined = source.required;
  const fullContent: boolean | undefined = source.full_content_required;
  void [version, descriptor, excerpt, previewOnly, required, fullContent];
}
