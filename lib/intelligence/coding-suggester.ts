import Anthropic from '@anthropic-ai/sdk'
import type { CodeSuggestion, AthenaEncounterNote } from '../athena/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a certified professional medical coder (CPC) specializing in primary care E&M coding under 2021 AMA guidelines. Analyze clinical notes and suggest accurate, compliant codes.

RULES:
- Base E&M on MDM OR Total Time — whichever is documented
- Never upcode — only suggest codes the note fully supports
- Explain reasoning in plain language the provider can understand

2021 E&M LEVELS (Office/Outpatient established):
- 99212: Straightforward MDM OR 10-19 min
- 99213: Low complexity MDM OR 20-29 min
- 99214: Moderate complexity MDM OR 30-39 min
- 99215: High complexity MDM OR 40-54 min

MDM HIGH COMPLEXITY requires 2 of 3:
1. Problems: severe exacerbation of chronic illness, new problem with uncertain prognosis, or threat to life/function
2. Data: independent interpretation of tests + discussion with other provider + review external records
3. Risk: drug therapy requiring intensive monitoring, decision re: hospitalization, or DNR decision

RESPOND ONLY WITH VALID JSON:
{
  "emLevel": "99214",
  "icd10Codes": [{"code": "E11.9", "description": "Type 2 diabetes mellitus", "confidence": 0.95}],
  "cptCodes": [{"code": "99214", "description": "Office visit moderate complexity", "units": 1}],
  "modifiers": [],
  "confidence": 0.92,
  "mdmLevel": "moderate",
  "timeMinutes": 35,
  "reasoning": "Plain English explanation of code selection and MDM rationale",
  "documentationGaps": ["Any missing documentation that weakens the claim"]
}`

export interface CodingSuggestionResult {
  suggestion: CodeSuggestion & { documentationGaps?: string[] }
  promptTokens: number
  completionTokens: number
  model: string
}

export async function suggestCodesForEncounter(
  note: AthenaEncounterNote
): Promise<CodingSuggestionResult> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Analyze this encounter note and suggest codes.\n\nENCOUNTER DATE: ${note.encounterdate}\nTYPE: ${note.encountertype}\n\nNOTE:\n${note.notetext}\n\nReturn JSON only.`
    }],
  })

  const raw = response.content.filter(b => b.type === 'text').map(b => b.text).join('')
  const json = raw.replace(/```json\n?|\n?```/g, '').trim()

  let parsed: CodeSuggestion & { documentationGaps?: string[] }
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error(`Failed to parse coding response: ${raw.slice(0, 200)}`)
  }

  return {
    suggestion: parsed,
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
    model: response.model,
  }
}

export function estimateBatchCost(encounterCount: number) {
  const cost = (encounterCount * 1500 / 1_000_000) * 3 + (encounterCount * 200 / 1_000_000) * 15
  return { estimatedCostUSD: Math.round(cost * 10000) / 10000 }
}
