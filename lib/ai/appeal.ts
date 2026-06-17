import Anthropic from '@anthropic-ai/sdk'
import type { Finding } from '../canonical'
import { formatCents } from '../canonical'
import { getAnthropicClient, APPEAL_MODEL } from './client'

/**
 * Appeal-letter drafting (Layer 7 — language task).
 *
 * The diff engine computes every dollar figure; the LLM only writes prose
 * around those figures. The deterministic vs. LLM boundary (CLAUDE.md) is
 * enforced here two ways:
 *   1. The prompt forbids stating any dollar amount other than the ones supplied.
 *   2. After generation we scan the letter and reject it if it contains any
 *      `$` figure outside the allowed set — falling back to a deterministic
 *      template. The model can never sneak a fabricated number into the output.
 *
 * On sample data this runs live against Claude. On real claim data it refuses
 * to call the API until the Anthropic BAA gate is open (ALLOW_REAL_PHI=true).
 */

export interface AppealDraft {
  letter: string
  mode: 'llm' | 'template'
  model?: string
  note?: string
}

/** Only payer-recoverable findings get a letter; undercoding is a re-code, not an appeal. */
export function isAppealDraftable(finding: Finding): boolean {
  return finding.appealable && (finding.type === 'denial' || finding.type === 'underpayment')
}

const MONEY_RE = /\$[\d,]+\.\d{2}/g

function allowedAmounts(finding: Finding): string[] {
  return [finding.expectedCents, finding.actualCents, finding.deltaCents, finding.recoverableCents].map(
    formatCents,
  )
}

/** Dollar figures in `text` that are NOT in the allowed set (i.e. fabricated). */
export function findInventedAmounts(text: string, allowed: string[]): string[] {
  const ok = new Set(allowed)
  return (text.match(MONEY_RE) ?? []).filter((amount) => !ok.has(amount))
}

/** Deterministic, no-LLM letter. Uses only diff-computed figures. */
export function appealTemplate(finding: Finding): string {
  const dos = finding.dateOfService ?? 'the date of service'
  const proc = `CPT/HCPCS ${finding.cptHcpcs}${
    finding.modifiers.length ? `, modifier ${finding.modifiers.join(', ')}` : ''
  }`

  if (finding.type === 'denial') {
    return [
      `Re: Appeal of denied claim ${finding.claimControlNumber} — ${proc}, date of service ${dos}`,
      ``,
      `To the Provider Appeals Department at ${finding.payerName}:`,
      ``,
      `We are formally appealing the denial of the above claim line (${proc}).`,
      finding.carcCode ? `The remittance advice denied this line under CARC ${finding.carcCode}.` : '',
      `Based on the member's coverage and our documentation, this service was payable. The contracted allowance for this line is ${formatCents(
        finding.expectedCents,
      )}, and we request reprocessing and payment of ${formatCents(finding.recoverableCents)}.`,
      ``,
      `Supporting documentation is available upon request. Please reprocess this claim and remit payment accordingly.`,
      ``,
      `Sincerely,`,
      `Provider Billing Office`,
    ]
      .filter(Boolean)
      .join('\n')
  }

  return [
    `Re: Reprocessing request for underpaid claim ${finding.claimControlNumber} — ${proc}, date of service ${dos}`,
    ``,
    `To the Provider Reimbursement Department at ${finding.payerName}:`,
    ``,
    `This claim line (${proc}) was paid ${formatCents(
      finding.actualCents,
    )}, below the contracted rate of ${formatCents(finding.expectedCents)}.`,
    `We request reprocessing and payment of the ${formatCents(
      finding.recoverableCents,
    )} difference in accordance with our contracted fee schedule.`,
    ``,
    `Supporting documentation is available upon request. Please review and remit the additional payment.`,
    ``,
    `Sincerely,`,
    `Provider Billing Office`,
  ]
    .filter(Boolean)
    .join('\n')
}

export async function draftAppealLetter(finding: Finding): Promise<AppealDraft> {
  if (!isAppealDraftable(finding)) {
    return { letter: appealTemplate(finding), mode: 'template', note: 'Not an appealable finding.' }
  }

  // PHI gate: never send real patient data to the model before the BAA gate (COMPLIANCE.md).
  const usingRealData = process.env.EDI_USE_SAMPLE_FILES === 'false'
  if (usingRealData && process.env.ALLOW_REAL_PHI !== 'true') {
    return {
      letter: appealTemplate(finding),
      mode: 'template',
      note: 'Real claim data with ALLOW_REAL_PHI=false — used the offline template (Anthropic BAA gate not open).',
    }
  }

  const client = getAnthropicClient()
  if (!client) {
    return {
      letter: appealTemplate(finding),
      mode: 'template',
      note: 'ANTHROPIC_API_KEY not set — used the offline template.',
    }
  }

  const allowed = allowedAmounts(finding)
  const system = [
    'You are an expert medical-billing appeals writer for a US physician practice.',
    'Write a professional, concise appeal letter to the payer in plain text.',
    'CRITICAL: Use only the exact dollar figures provided in the user message, verbatim.',
    'Never state, compute, or estimate any other dollar amount, and do not include any figure not given to you.',
    'Do not invent member names, dates, policy numbers, or clinical facts beyond what is provided.',
    'Cite the adjustment reason code when one is given, and request reprocessing and payment.',
  ].join(' ')

  const facts = [
    `Payer: ${finding.payerName}`,
    `Claim control number: ${finding.claimControlNumber}`,
    `Procedure: CPT/HCPCS ${finding.cptHcpcs}${
      finding.modifiers.length ? `, modifiers ${finding.modifiers.join(', ')}` : ''
    }`,
    finding.dateOfService ? `Date of service: ${finding.dateOfService}` : '',
    finding.carcCode ? `Adjustment reason code (CARC): ${finding.carcCode}` : '',
    `Contracted/expected allowance: ${formatCents(finding.expectedCents)}`,
    `Amount paid: ${formatCents(finding.actualCents)}`,
    `Amount to recover: ${formatCents(finding.recoverableCents)}`,
    ``,
    `Use only these dollar figures, verbatim, and no others: ${allowed.join(', ')}`,
    ``,
    finding.type === 'denial'
      ? 'Write an appeal letter contesting the denial and requesting reprocessing and payment.'
      : 'Write a reprocessing-request letter for the underpaid difference versus the contracted rate.',
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const message = await client.messages.create({
      model: APPEAL_MODEL,
      max_tokens: 8192,
      thinking: { type: 'adaptive' },
      system,
      messages: [{ role: 'user', content: facts }],
    })

    if (message.stop_reason === 'refusal') {
      return { letter: appealTemplate(finding), mode: 'template', note: 'Model declined — used the offline template.' }
    }

    const letter = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim()

    const invented = findInventedAmounts(letter, allowed)
    if (!letter || message.stop_reason === 'max_tokens' || invented.length > 0) {
      return {
        letter: appealTemplate(finding),
        mode: 'template',
        note: invented.length
          ? `Guardrail tripped: model introduced ${invented.join(', ')} — used the deterministic template instead.`
          : 'Draft was incomplete — used the offline template.',
      }
    }

    return { letter, mode: 'llm', model: message.model }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'API error'
    return { letter: appealTemplate(finding), mode: 'template', note: `Draft failed (${reason}) — used the offline template.` }
  }
}
