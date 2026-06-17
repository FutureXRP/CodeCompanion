import { analyze } from '@/lib/analyze/run'

// Parses provided 837/835/fee-schedule text in memory and returns the analysis.
// Nothing is persisted. Use synthetic or de-identified data until the BAA gate
// is closed (COMPLIANCE.md).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const body = (raw ?? {}) as { edi837?: unknown; edi835?: unknown; feeScheduleCsv?: unknown }
  if (
    typeof body.edi837 !== 'string' ||
    typeof body.edi835 !== 'string' ||
    typeof body.feeScheduleCsv !== 'string'
  ) {
    return Response.json(
      { error: 'edi837, edi835, and feeScheduleCsv (strings) are required' },
      { status: 400 },
    )
  }

  try {
    return Response.json(analyze(body.edi837, body.edi835, body.feeScheduleCsv))
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Analysis failed' }, { status: 400 })
  }
}
