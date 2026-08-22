import { NextResponse } from 'next/server';
import { getPackCatalog, getPackConfig } from '@/lib/exchangeRate';

export async function GET() {
  return NextResponse.json({
    ...getPackConfig('starter'),
    packs: getPackCatalog()
  });
}
