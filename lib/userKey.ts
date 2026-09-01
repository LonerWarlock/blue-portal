import { createHash, randomBytes } from 'crypto';
import { statusError } from '@/lib/bluePayg';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export interface UserKeyEnvelope {
  key: string;
  masked: boolean;
  revealable: boolean;
  message: string;
}

export async function getOrCreateUserKey(userId: string): Promise<UserKeyEnvelope> {
  if (!supabaseAdmin) throw statusError(500, 'Database is not configured');

  const { data, error } = await supabaseAdmin
    .from('user_keys')
    .select('key_hash, key_prefix, last_four')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw statusError(500, 'Failed to retrieve Blue API key');

  if (data?.key_hash) {
    const prefix = String(data.key_prefix || 'blue_');
    const lastFour = String(data.last_four || '');
    return {
      key: `${prefix}${'•'.repeat(12)}${lastFour}`,
      masked: true,
      revealable: false,
      message: 'For security, an existing key cannot be shown again. Rotate it to receive a new key.',
    };
  }

  return rotateUserKey(userId);
}

export async function rotateUserKey(userId: string): Promise<UserKeyEnvelope> {
  if (!supabaseAdmin) throw statusError(500, 'Database is not configured');

  const key = `blue_${randomBytes(24).toString('base64url')}`;
  const keyHash = createHash('sha256').update(key).digest('hex');
  const { error } = await supabaseAdmin
    .from('user_keys')
    .upsert({
      user_id: userId,
      key: null,
      key_hash: keyHash,
      key_prefix: key.slice(0, 10),
      last_four: key.slice(-4),
      rotated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (error) throw statusError(500, 'Failed to generate Blue API key');

  return {
    key,
    masked: false,
    revealable: true,
    message: 'Copy this key now. It will not be shown again.',
  };
}
