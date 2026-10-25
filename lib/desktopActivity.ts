/** Deliberately contains no conversation, task text, paths, URLs, or raw errors. */
export const DESKTOP_ACTIVITY_MAX_BYTES = 65_536;
export const DESKTOP_ACTIVITY_MAX_RUNS = 32;
export const DESKTOP_ACTIVITY_ERROR_CODES = [
  'timeout', 'connection', 'authentication', 'rate_limit', 'credits', 'permission',
  'workspace', 'provider', 'internal', 'cancelled', 'unknown',
] as const;

export type DesktopActivityErrorCode = typeof DESKTOP_ACTIVITY_ERROR_CODES[number];
export interface DesktopActivityRun {
  run_id: string;
  revision: 1 | 2;
  kind: 'chat' | 'team' | 'coordinator' | 'diagnostic';
  status: 'started' | 'completed' | 'failed' | 'stopped' | 'interrupted';
  provider: 'blue' | 'openrouter' | 'opencode' | 'unknown';
  model: string | null;
  engine: 'codex' | 'opencode' | null;
  duration_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  error_code: DesktopActivityErrorCode | null;
}
export interface DesktopActivityBatch {
  schema_version: 1;
  session_id: string;
  app_version: string;
  presence: 'active' | 'closed' | null;
  runs: DesktopActivityRun[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VERSION = /^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$/;
const MODEL = /^[a-z0-9][a-z0-9._:-]*(?:\/[a-z0-9][a-z0-9._:-]*)?$/i;
const SECRET = /(?:^|\/)(?:sk[-_]|gsk[-_]|github_pat_|sb[-_]|eyJ|AIza|gh[pousr]_|xox[baprs]-|bearer|token[-_:])/i;
const URI_OR_DRIVE = /^[a-z][a-z0-9+.-]*:\//i;
const RUN_KEYS = [
  'run_id', 'revision', 'kind', 'status', 'provider', 'model', 'engine', 'duration_ms',
  'input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_write_tokens', 'error_code',
];
function objectWithKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && Object.keys(value).every(key => keys.includes(key));
}
function member(value: unknown, values: readonly unknown[]): boolean { return values.includes(value); }
function count(value: unknown): boolean {
  return value === null || typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2_147_483_647;
}
export function isDesktopModelId(value: unknown): value is string | null {
  return value === null || typeof value === 'string' && value.length <= 128
    && MODEL.test(value) && !SECRET.test(value) && !URI_OR_DRIVE.test(value) && !value.includes('..');
}

/** Returns a fresh, explicitly projected DTO; rejected payloads are never logged. */
export function validateDesktopActivity(value: unknown): DesktopActivityBatch | null {
  if (!objectWithKeys(value, ['schema_version', 'session_id', 'app_version', 'presence', 'runs'])
    || value.schema_version !== 1 || typeof value.session_id !== 'string' || !UUID.test(value.session_id)
    || typeof value.app_version !== 'string' || !VERSION.test(value.app_version)
    || !member(value.presence, ['active', 'closed', null]) || !Array.isArray(value.runs)
    || value.runs.length > DESKTOP_ACTIVITY_MAX_RUNS || value.presence === null && value.runs.length === 0) return null;
  const ids = new Set<string>();
  const runs: DesktopActivityRun[] = [];
  for (const run of value.runs) {
    if (!objectWithKeys(run, RUN_KEYS) || typeof run.run_id !== 'string' || !UUID.test(run.run_id)
      || ids.has(run.run_id.toLowerCase()) || !member(run.revision, [1, 2])
      || !member(run.kind, ['chat', 'team', 'coordinator', 'diagnostic'])
      || !member(run.status, ['started', 'completed', 'failed', 'stopped', 'interrupted'])
      || (run.revision === 1) !== (run.status === 'started')
      || !member(run.provider, ['blue', 'openrouter', 'opencode', 'unknown'])
      || !isDesktopModelId(run.model) || !member(run.engine, ['codex', 'opencode', null])
      || !['duration_ms', 'input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_write_tokens'].every(key => count(run[key]))
      || !member(run.error_code, [...DESKTOP_ACTIVITY_ERROR_CODES, null])
      || run.revision === 1 && (run.duration_ms !== null || run.error_code !== null)
      || run.status === 'completed' && run.error_code !== null) return null;
    ids.add(run.run_id.toLowerCase());
    runs.push(Object.fromEntries(RUN_KEYS.map(key => [key, run[key]])) as unknown as DesktopActivityRun);
  }
  return {schema_version: 1, session_id: value.session_id.toLowerCase(), app_version: value.app_version,
    presence: value.presence as DesktopActivityBatch['presence'], runs};
}
