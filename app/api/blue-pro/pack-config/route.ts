import { NextResponse } from 'next/server';
import { getPackConfig } from '@/lib/exchangeRate';

export async function GET() {
  const pack = getPackConfig();
  return NextResponse.json(pack);
}
