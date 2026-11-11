import { loadFoundMoney } from '@/lib/found-money/source'
import { findingsToCsv, reportToJson } from '@/lib/found-money/export'

// Generates the report server-side on the same source the Found Money page
// shows (the Tebra pull, or the 837/835 files) and streams it as a download.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  const format = new URL(request.url).searchParams.get('format') ?? 'csv'
  let report
  try {
    report = (await loadFoundMoney()).report
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }

  if (format === 'json') {
    return new Response(reportToJson(report), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': 'attachment; filename="found-money.json"',
      },
    })
  }

  return new Response(findingsToCsv(report.findings), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="found-money.csv"',
    },
  })
}
