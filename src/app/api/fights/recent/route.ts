import { NextResponse } from 'next/server';
import { readTodaysFights } from '@/lib/fightStore';
import { RECENT_FIGHTS } from '@/lib/fights';

// The file changes as games finish: never cache this response.
export const dynamic = 'force-dynamic';

/** Today's latest fights for the landing-page carousel (newest first). */
export function GET() {
  return NextResponse.json(readTodaysFights().slice(0, RECENT_FIGHTS));
}
