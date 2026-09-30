export interface BlueCreditSummary {
  available_blue_credits: number;
  temporarily_held_blue_credits: number;
  total_blue_credits: number;
  hold_count: number;
  pending_settlement_blue_credits: number;
  pending_settlement_count: number;
  as_of: string;
}

interface CreditSnapshotDatabase {
  rpc(name: string, args: { user_id_param: string }): PromiseLike<{ data?: unknown; error?: unknown }>;
}

/** An optional display snapshot; existing wallet fields remain access authority. */
export async function getBlueCreditSummary(
  database: CreditSnapshotDatabase,
  userId: string
): Promise<BlueCreditSummary | undefined> {
  try {
    const result = await database.rpc('blue_credit_snapshot', { user_id_param: userId });
    return result.error ? undefined : publicBlueCreditSummary(result.data);
  } catch {
    return undefined;
  }
}

/** Explicit whitelist: never copy credentials or raw reservation/task records. */
export function publicBlueCreditSummary(value: unknown): BlueCreditSummary | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const available = nonNegativeNumber(input.available_blue_credits);
  const held = nonNegativeNumber(input.temporarily_held_blue_credits);
  const total = nonNegativeNumber(input.total_blue_credits);
  const holdCount = nonNegativeNumber(input.hold_count);
  const pending = nonNegativeNumber(input.pending_settlement_blue_credits);
  const pendingCount = nonNegativeNumber(input.pending_settlement_count);
  if (available === undefined || held === undefined || total === undefined
    || holdCount === undefined || pending === undefined || pendingCount === undefined
    || !Number.isInteger(holdCount) || !Number.isInteger(pendingCount)
    || pendingCount > holdCount || pending > held + 1e-9
    || Math.abs(total - available - held) > 1e-9
    || typeof input.as_of !== 'string' || !Number.isFinite(Date.parse(input.as_of))) {
    return undefined;
  }
  return {
    available_blue_credits: available,
    temporarily_held_blue_credits: held,
    total_blue_credits: total,
    hold_count: holdCount,
    pending_settlement_blue_credits: pending,
    pending_settlement_count: pendingCount,
    as_of: input.as_of
  };
}

function nonNegativeNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
