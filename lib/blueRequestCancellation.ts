import { BluePaygAccount, statusError } from '@/lib/bluePayg';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type ActiveRequest = {
  userId: string;
  abort: () => void;
};

const activeRequests = new Map<string, ActiveRequest>();

export function registerBlueGatewayRequest(requestId: string, account: BluePaygAccount, controller: AbortController): void {
  activeRequests.set(requestId, {
    userId: account.userId,
    abort: () => controller.abort('Blue task cancelled by the user')
  });
}

export function unregisterBlueGatewayRequest(requestId: string): void {
  activeRequests.delete(requestId);
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
