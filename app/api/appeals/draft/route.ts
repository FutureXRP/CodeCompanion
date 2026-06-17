import { runFoundMoney } from '@/lib/found-money/run'
import { draftAppealLetter } from '@/lib/ai/appeal'

// Drafts an appeal for one finding. The financial facts are recomputed
// server-side from the finding id — the client never supplies dollar figures.
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

  const finding = runFoundMoney().findings.find((f) => f.id === findingId)
  if (!finding) {
    return Response.json({ error: 'Finding not found' }, { status: 404 })
  }

  const draft = await draftAppealLetter(finding)
  return Response.json(draft)
}
