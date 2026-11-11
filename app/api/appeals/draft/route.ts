import { loadFoundMoney } from '@/lib/found-money/source'
import { draftAppealLetter } from '@/lib/ai/appeal'

// Drafts an appeal for one finding. The financial facts are recomputed
// server-side from the finding id — the client never supplies dollar figures.
// The finding is looked up on the same source the Found Money page shows (the
// Tebra pull, or the 837/835 files), so what is on screen is what gets drafted.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  let findingId: unknown
  try {
    findingId = (await request.json())?.findingId
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (typeof findingId !== 'string') {
    return Response.json({ error: 'findingId (string) is required' }, { status: 400 })
  }

  let finding
  try {
    finding = (await loadFoundMoney()).report.findings.find((f) => f.id === findingId)
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
  if (!finding) {
    return Response.json({ error: 'Finding not found' }, { status: 404 })
  }

  const draft = await draftAppealLetter(finding)
  return Response.json(draft)
}
