import { runFoundMoney } from '@/lib/found-money/run'
import { findingsToCsv, reportToJson } from '@/lib/found-money/export'

// Generates the report server-side and streams it as a download.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET(request: Request): Response {
  const format = new URL(request.url).searchParams.get('format') ?? 'csv'
  const report = runFoundMoney()

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
