import { NextResponse } from 'next/server';
import { readFights } from '@/lib/fightStore';
import { RECENT_FIGHTS } from '@/lib/fights';

// The file changes as games finish: never cache this response.
export const dynamic = 'force-dynamic';

/** The latest fights for the landing-page carousel (newest first). */
export function GET() {
  return NextResponse.json(readFights().slice(0, RECENT_FIGHTS));
}
