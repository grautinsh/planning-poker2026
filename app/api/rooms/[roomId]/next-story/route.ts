// app/api/rooms/[roomId]/next-story/route.ts — STUB: implementation in Phase 3 Plan 02
// This file exists so test imports resolve. The real implementation replaces this body.
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  _context: { params: Promise<{ roomId: string }> }
): Promise<NextResponse> {
  throw new Error('TODO: not implemented')
}
