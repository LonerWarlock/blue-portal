import { createHash, timingSafeEqual } from 'crypto';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export function authorizeCron(request: Request): boolean {
  const configured = String(process.env.CRON_SECRET || '');
  if (!configured) return false;
  const authorization = String(request.headers.get('authorization') || '');
  if (!authorization.startsWith('Bearer ')) return false;
  const supplied = authorization.slice(7).trim();
  if (!supplied) return false;
  return timingSafeEqual(digest(configured), digest(supplied));
}
