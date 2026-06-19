/**
 * One clinic-day at a synthetic Oklahoma primary-care practice — 15 patients with
 * full charts. NO real PHI: invented names, member ids, and NPIs. This is the
 * source data the mock EHR renders as a FHIR bundle. Crafted to exercise the
 * pipeline: multiple payers (Medicare/Novitas, SoonerCare, BCBS OK, Aetna), a
 * modifier-25 case (E/M + procedure), a correct modifier-25 case, a 99215 denial,
 * commercial copays/coinsurance, and Medicaid $0 responsibility.
 */

export type PayerKey = 'medicare' | 'soonercare' | 'bcbsok' | 'aetna'
export type ProviderKey = 'blair' | 'nguyen'

export interface RosterPayer {
  id: string
  name: string
  filing: 'MB' | 'MC' | 'CI'
  contractClass: 'medicare' | 'medicaid' | 'commercial'
}

export const PAYERS: Record<PayerKey, RosterPayer> = {
  medicare: { id: '04312', name: 'Medicare (Novitas JH)', filing: 'MB', contractClass: 'medicare' },
  soonercare: { id: 'SKOK0', name: 'SoonerCare (OHCA)', filing: 'MC', contractClass: 'medicaid' },
  bcbsok: { id: '00840', name: 'BCBS Oklahoma', filing: 'CI', contractClass: 'commercial' },
  aetna: { id: '60054', name: 'Aetna', filing: 'CI', contractClass: 'commercial' },
}

// NPIs below pass the NPI check digit (Luhn over "80840" + the 9-digit base).
export const PROVIDERS: Record<ProviderKey, { npi: string; first: string; last: string; specialty: string }> = {
  blair: { npi: '1234567893', first: 'MATTHEW', last: 'BLAIR', specialty: 'family_medicine' },
  nguyen: { npi: '1083675441', first: 'LINH', last: 'NGUYEN', specialty: 'family_medicine' },
}

export const CLINIC = {
  npi: '1326543216',
  taxId: '731234567',
  name: 'SquareOne Family Medicine',
  taxonomy: '207Q00000X',
  address: { line: '4200 E 31st St', city: 'Tulsa', state: 'OK', postalCode: '74135' },
  phone: '9185550140',
}

export interface RosterService {
  cpt: string
  charge: number // dollars
  units?: number
  modifiers?: string[]
  /** Diagnoses (dotted ICD-10) this line supports — must be a subset of the visit dx. */
  dx: string[]
}

export interface RosterPatient {
  id: string
  first: string
  last: string
  dob: string
  gender: 'male' | 'female'
  city: string
  payer: PayerKey
  memberId: string
  provider: ProviderKey
  /** Chronic problem list (dotted ICD-10) — chart context, not billed unless addressed. */
  problems: string[]
  pos?: string
  /** Diagnoses addressed at today's visit (dotted ICD-10). */
  visitDx: string[]
  services: RosterService[]
}

export const PATIENTS: RosterPatient[] = [
  { id: 'pt01', first: 'Eleanor', last: 'Whitfield', dob: '1948-03-12', gender: 'female', city: 'Tulsa', payer: 'medicare', memberId: '1EG4TE5MK73', provider: 'blair',
    problems: ['E11.9', 'I10', 'E78.5'], visitDx: ['E11.65', 'I10'],
    services: [{ cpt: '99214', charge: 175, dx: ['E11.65', 'I10'] }, { cpt: '36415', charge: 25, dx: ['E11.65'] }] },

  { id: 'pt02', first: 'Harold', last: 'Benson', dob: '1951-07-30', gender: 'male', city: 'Broken Arrow', payer: 'medicare', memberId: '2FH5UF6NL84', provider: 'blair',
    problems: ['I10', 'M17.11'], visitDx: ['Z00.00', 'I10'],
    // Annual wellness + a problem addressed same day → modifier 25 used CORRECTLY.
    services: [{ cpt: 'G0439', charge: 170, dx: ['Z00.00'] }, { cpt: '99214', charge: 175, modifiers: ['25'], dx: ['I10'] }] },

  { id: 'pt03', first: 'Maria', last: 'Castellano', dob: '1989-11-05', gender: 'female', city: 'Tulsa', payer: 'bcbsok', memberId: 'BCB774120933', provider: 'nguyen',
    problems: [], visitDx: ['J06.9'],
    services: [{ cpt: '99213', charge: 110, dx: ['J06.9'] }] },

  { id: 'pt04', first: 'Walter', last: 'Kowalski', dob: '1955-01-22', gender: 'male', city: 'Owasso', payer: 'medicare', memberId: '3GI6VG7OM95', provider: 'blair',
    problems: ['E11.9', 'E78.5', 'I10'], visitDx: ['E11.9', 'E78.5', 'I10'],
    // E/M + EKG same day, NO modifier 25 → scrubber CCI-25 warning.
    services: [{ cpt: '99214', charge: 175, dx: ['E11.9', 'I10'] }, { cpt: '93000', charge: 75, dx: ['I10'] }] },

  { id: 'pt05', first: 'Priya', last: 'Nair', dob: '1978-09-14', gender: 'female', city: 'Jenks', payer: 'aetna', memberId: 'AET551209847', provider: 'nguyen',
    problems: ['E03.9'], visitDx: ['E03.9'],
    services: [{ cpt: '99213', charge: 110, dx: ['E03.9'] }, { cpt: '36415', charge: 25, dx: ['E03.9'] }] },

  { id: 'pt06', first: 'James', last: 'Okafor', dob: '1962-05-08', gender: 'male', city: 'Tulsa', payer: 'bcbsok', memberId: 'BCB880345112', provider: 'blair',
    problems: ['I50.32', 'N18.30', 'E11.22'], visitDx: ['I50.32', 'N18.30', 'E11.22'],
    // High-complexity visit → mock payer denies 99215 (auth) → appeal worklist.
    services: [{ cpt: '99215', charge: 250, dx: ['I50.32', 'N18.30', 'E11.22'] }] },

  { id: 'pt07', first: 'Sofia', last: 'Ramirez', dob: '2016-04-19', gender: 'female', city: 'Sand Springs', payer: 'soonercare', memberId: 'SC0099142', provider: 'nguyen',
    problems: [], visitDx: ['Z00.129'],
    services: [{ cpt: '99213', charge: 110, dx: ['Z00.129'] }] },

  { id: 'pt08', first: 'Tyler', last: 'Goodwin', dob: '2009-12-02', gender: 'male', city: 'Tulsa', payer: 'soonercare', memberId: 'SC0099188', provider: 'nguyen',
    problems: ['J45.909'], visitDx: ['J45.909'],
    services: [{ cpt: '99214', charge: 175, dx: ['J45.909'] }] },

  { id: 'pt09', first: 'Deborah', last: 'Fischer', dob: '1972-02-28', gender: 'female', city: 'Bixby', payer: 'aetna', memberId: 'AET551330926', provider: 'blair',
    problems: [], visitDx: ['Z00.00'],
    services: [{ cpt: '99396', charge: 225, dx: ['Z00.00'] }] },

  { id: 'pt10', first: 'Raymond', last: 'Childers', dob: '1959-10-17', gender: 'male', city: 'Tulsa', payer: 'bcbsok', memberId: 'BCB774551208', provider: 'blair',
    problems: ['I10'], visitDx: ['I10'],
    services: [{ cpt: '99213', charge: 110, dx: ['I10'] }] },

  { id: 'pt11', first: 'Angela', last: 'Pham', dob: '1985-06-25', gender: 'female', city: 'Owasso', payer: 'medicare', memberId: '4HJ7WH8PN06', provider: 'nguyen',
    problems: ['M54.50'], visitDx: ['M54.50'],
    services: [{ cpt: '99213', charge: 110, dx: ['M54.50'] }] },

  { id: 'pt12', first: 'Marcus', last: 'Delgado', dob: '1994-08-11', gender: 'male', city: 'Tulsa', payer: 'aetna', memberId: 'AET551447100', provider: 'nguyen',
    problems: ['F41.1'], visitDx: ['F41.1', 'F32.9'],
    services: [{ cpt: '99214', charge: 175, dx: ['F41.1', 'F32.9'] }] },

  { id: 'pt13', first: 'Karen', last: 'Stoltz', dob: '1968-12-09', gender: 'female', city: 'Glenpool', payer: 'bcbsok', memberId: 'BCB880667431', provider: 'blair',
    problems: [], visitDx: ['N39.0'],
    services: [{ cpt: '99213', charge: 110, dx: ['N39.0'] }, { cpt: '81002', charge: 15, dx: ['N39.0'] }] },

  { id: 'pt14', first: 'Frank', last: 'Mueller', dob: '1946-11-03', gender: 'male', city: 'Tulsa', payer: 'medicare', memberId: '5IK8XI9QO17', provider: 'blair',
    problems: ['J44.9', 'I10'], visitDx: ['J44.9'],
    services: [{ cpt: '99214', charge: 175, dx: ['J44.9'] }, { cpt: '94760', charge: 20, dx: ['J44.9'] }] },

  { id: 'pt15', first: 'Lucia', last: 'Moreno', dob: '2018-01-27', gender: 'female', city: 'Tulsa', payer: 'soonercare', memberId: 'SC0099244', provider: 'nguyen',
    problems: [], visitDx: ['Z00.129'],
    services: [{ cpt: '99213', charge: 110, dx: ['Z00.129'] }] },
]
