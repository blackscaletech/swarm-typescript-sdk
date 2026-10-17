export interface RuntimeCredential {
  id: string;
  identity_id: string;
  entity_id: string;
  space_id?: string;
  kind: string;
  class: string;
  token_prefix: string;
  source_table?: string;
  source_id?: string;
  status: string;
  created_at: string;
  expires_at?: string;
  last_used_at?: string;
  revoked_at?: string;
  rotated_at?: string;
  replaced_by_credential_id?: string;
}

export interface IssuedRuntimeCredential {
  credential: RuntimeCredential;
  token: string;
}
