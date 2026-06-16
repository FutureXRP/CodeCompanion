/**
 * CARC (Claim Adjustment Reason Code) classification.
 *
 * Standard HIPAA code set (not vendor-specific), so it lives with the diff
 * engine that consumes it rather than in an adapter. Classifies each reason as
 * contractual / patient / denial and, for denials, whether it is appealable.
 * This drives recovery ranking — and is deterministic, never LLM-derived.
 */

export type CarcCategory = 'contractual' | 'denial' | 'patient' | 'other'

export interface CarcInfo {
  code: string
  description: string
  category: CarcCategory
  appealable: boolean
}

const TABLE: Record<string, Omit<CarcInfo, 'code'>> = {
  '45': { description: 'Charge exceeds fee schedule / maximum allowable', category: 'contractual', appealable: false },
  '253': { description: 'Sequestration — federal payment reduction', category: 'contractual', appealable: false },
  '1': { description: 'Deductible amount', category: 'patient', appealable: false },
  '2': { description: 'Coinsurance amount', category: 'patient', appealable: false },
  '3': { description: 'Co-payment amount', category: 'patient', appealable: false },
  '4': { description: 'Procedure inconsistent with modifier, or required modifier missing', category: 'denial', appealable: true },
  '11': { description: 'Diagnosis inconsistent with the procedure', category: 'denial', appealable: true },
  '16': { description: 'Claim/service lacks information needed for adjudication', category: 'denial', appealable: true },
  '18': { description: 'Exact duplicate claim/service', category: 'denial', appealable: false },
  '22': { description: 'May be covered by another payer per coordination of benefits', category: 'denial', appealable: true },
  '26': { description: 'Expenses incurred prior to coverage', category: 'denial', appealable: false },
  '27': { description: 'Expenses incurred after coverage terminated', category: 'denial', appealable: false },
  '29': { description: 'Time limit for filing has expired', category: 'denial', appealable: false },
  '50': { description: 'Not deemed a medical necessity by the payer', category: 'denial', appealable: true },
  '96': { description: 'Non-covered charge(s)', category: 'denial', appealable: false },
  '97': { description: 'Payment bundled/included in another service already adjudicated', category: 'denial', appealable: true },
  '197': { description: 'Precertification/authorization/notification absent', category: 'denial', appealable: true },
}

const UNKNOWN_DENIAL: Omit<CarcInfo, 'code'> = {
  description: 'Unrecognized adjustment reason — manual review',
  category: 'denial',
  appealable: true,
}

export function classifyCarc(code: string): CarcInfo {
  const found = TABLE[code]
  return found ? { code, ...found } : { code, ...UNKNOWN_DENIAL }
}
