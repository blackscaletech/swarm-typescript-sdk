import type {
  BootstrapCurrentUserEntityInput,
  BootstrapSpaceInput,
  ConnectClientInput,
  ConnectCurrentUserAndLaunchInput,
  ConnectCurrentUserClientInput,
  LaunchRunInput
} from "./types.js";

export function defaultMutationIdempotencyKey(method: string, path: string, body?: unknown, operationPath?: string, explicitStrategy?: "fresh-attempt" | "durable-content"): string | null;

export function buildLaunchRunIdempotencyKey(
  spaceId: string,
  input?: LaunchRunInput,
  intentKey?: string
): string;

export function buildBootstrapSpaceIdempotencyKey(
  entityId: string,
  input?: BootstrapSpaceInput,
  intentKey?: string
): string;

export function buildConnectClientIdempotencyKey(
  spaceId: string,
  input?: ConnectClientInput,
  intentKey?: string
): string;

export function buildConnectSpaceClientIdempotencyKey(
  spaceId: string,
  input?: ConnectClientInput,
  intentKey?: string
): string;

export function buildConnectCurrentUserClientIdempotencyKey(
  input?: ConnectCurrentUserClientInput,
  intentKey?: string
): string;

export function buildBootstrapCurrentUserEntityIdempotencyKey(
  input?: BootstrapCurrentUserEntityInput,
  intentKey?: string
): string;

export function buildConnectCurrentUserAndLaunchIdempotencyKey(
  input?: ConnectCurrentUserAndLaunchInput,
  intentKey?: string
): string;
