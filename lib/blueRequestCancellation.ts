import { BluePaygAccount, statusError } from '@/lib/bluePayg';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type ActiveRequest = {
  userId: string;
  clientInstanceId?: string;
  abort: () => void;
};

const activeRequests = new Map<string, ActiveRequest>();
const CLIENT_INSTANCE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/;

export function registerBlueGatewayRequest(
  requestId: string,
  account: BluePaygAccount,
  controller: AbortController,
  clientInstanceId?: string
): void {
  activeRequests.set(requestId, {
    userId: account.userId,
    clientInstanceId: clientInstanceId && CLIENT_INSTANCE_ID.test(clientInstanceId)
      ? clientInstanceId
      : undefined,
    abort: () => controller.abort('Blue task cancelled by the user')
  });
}

export function unregisterBlueGatewayRequest(requestId: string): void {
  activeRequests.delete(requestId);
}

/**
 * Persists the opaque local-engine identity for a legacy gateway request.
 * Best effort is intentional: a deployment that has code before the migration
 * must keep serving completions; Stop still aborts locally in that brief gap.
 */
export async function registerBlueGatewayClientRequest(
  account: BluePaygAccount,
  requestId: string,
  clientInstanceId: string
): Promise<boolean> {
  if (!supabaseAdmin || !CLIENT_INSTANCE_ID.test(clientInstanceId)) return false;
  const { error } = await supabaseAdmin
    .from('blue_gateway_client_requests')
    .upsert({
      request_id: requestId,
      user_id: account.userId,
      client_instance_id: clientInstanceId,
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString()
    }, { onConflict: 'request_id' });
  if (error) {
    console.error('[Blue Gateway] Failed to register client stop handle:', error.message);
    return false;
  }
  return true;
}

export async function unregisterBlueGatewayClientRequest(requestId: string): Promise<void> {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin
    .from('blue_gateway_client_requests')
    .delete()
    .eq('request_id', requestId);
  if (error && !/does not exist|relation/i.test(error.message)) {
    console.error('[Blue Gateway] Failed to remove client stop handle:', error.message);
  }
}

export async function requestBlueGatewayCancellation(account: BluePaygAccount, requestId: string): Promise<{
  accepted: boolean;
  status: 'pending' | 'settled' | 'released' | 'not_found';
}> {
  if (!supabaseAdmin) throw statusError(500, 'Supabase admin is not configured');
  const { data, error } = await supabaseAdmin.rpc('cancel_blue_gateway_request', {
    user_id_param: account.userId,
    request_id_param: requestId
  });
  if (error) throw statusError(500, `Could not cancel Blue request: ${error.message}`);

  const result = {
    accepted: data?.accepted === true,
    status: data?.status === 'settled' || data?.status === 'released' || data?.status === 'pending'
      ? data.status
      : 'not_found' as const
  };
  const active = activeRequests.get(requestId);
  if (result.accepted && active?.userId === account.userId) active.abort();
  return result;
}

export async function isBlueGatewayCancellationRequested(account: BluePaygAccount, requestId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { data, error } = await supabaseAdmin
    .from('blue_request_cancellations')
    .select('request_id')
    .eq('request_id', requestId)
    .eq('user_id', account.userId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error) {
    console.error('[Blue Gateway] Failed to check request cancellation:', error.message);
    return false;
  }
  return Boolean(data?.request_id);
}

export async function requestBlueGatewayClientCancellation(
  account: BluePaygAccount,
  clientInstanceId: string
): Promise<{ accepted: boolean; cancelledCount: number }> {
  if (!supabaseAdmin) throw statusError(500, 'Supabase admin is not configured');
  if (!CLIENT_INSTANCE_ID.test(clientInstanceId)) throw statusError(400, 'Invalid Blue client instance ID');
  const { data, error } = await supabaseAdmin.rpc('cancel_blue_gateway_client_requests', {
    user_id_param: account.userId,
    client_instance_id_param: clientInstanceId
  });
  if (error) throw statusError(500, `Could not cancel active Blue request: ${error.message}`);

  activeRequests.forEach(active => {
    if (
      active.userId === account.userId &&
      active.clientInstanceId === clientInstanceId
    ) {
      active.abort();
    }
  });

  return {
    accepted: data?.accepted !== false,
    cancelledCount: Math.max(0, Number(data?.cancelled_count || 0))
  };
}

export async function isBlueGatewayClientCancellationRequested(
  account: BluePaygAccount,
  clientInstanceId: string
): Promise<boolean> {
  if (!supabaseAdmin || !CLIENT_INSTANCE_ID.test(clientInstanceId)) return false;
  const { data, error } = await supabaseAdmin.rpc('is_blue_gateway_client_cancellation_requested', {
    user_id_param: account.userId,
    client_instance_id_param: clientInstanceId
  });
  if (error) {
    // Treat a just-deployed code/database skew as unsupported cancellation,
    // never as a provider or billing failure.
    if (!/does not exist|function .* not found|schema cache/i.test(error.message)) {
      console.error('[Blue Gateway] Failed to check client cancellation:', error.message);
    }
    return false;
  }
  return data === true;
}
