#!/bin/bash
# CodeCompanion — Project Setup Script
# Run this once in your Codespace terminal to create all project files
# Usage: bash setup.sh

set -e
echo "🚀 Setting up CodeCompanion..."

# ── Create folder structure ──────────────────────────────────
mkdir -p \
  lib/athena \
  lib/intelligence \
  lib/supabase \
  lib/stripe \
  inngest/functions \
  supabase/migrations \
  "app/(auth)/sign-in/[[...sign-in]]" \
  "app/(auth)/sign-up/[[...sign-up]]" \
  "app/(dashboard)/coding" \
  "app/(dashboard)/gaps" \
  "app/(dashboard)/audit" \
  "app/(dashboard)/schedule" \
  "app/(dashboard)/settings" \
  app/api/inngest \
  app/api/athena/webhook \
  app/api/athena/oauth \
  "app/api/stripe/webhook" \
  components/dashboard \
  components/coding \
  components/gaps \
  components/audit \
  components/schedule \
  components/ui

echo "✓ Folders created"

# ── .gitignore ───────────────────────────────────────────────
cat > .gitignore << 'GITIGNORE'
/node_modules
/.pnp
.pnp.js
/coverage
/.next/
/out/
/build
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.vercel
*.tsbuildinfo
next-env.d.ts
.DS_Store
*.pem
npm-debug.log*
yarn-debug.log*
yarn-error.log*
GITIGNORE
echo "✓ .gitignore"

# ── package.json ─────────────────────────────────────────────
cat > package.json << 'PACKAGEJSON'
{
  "name": "codecompanion",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "inngest:dev": "npx inngest-cli@latest dev"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.24.0",
    "@clerk/nextjs": "^5.0.0",
    "@supabase/ssr": "^0.4.0",
    "@supabase/supabase-js": "^2.43.0",
    "clsx": "^2.1.1",
    "date-fns": "^3.6.0",
    "inngest": "^3.19.0",
    "lucide-react": "^0.383.0",
    "next": "14.2.4",
    "react": "^18",
    "react-dom": "^18",
    "stripe": "^15.12.0",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "eslint": "^8",
    "eslint-config-next": "14.2.4",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "typescript": "^5"
  }
}
PACKAGEJSON
echo "✓ package.json"

# ── next.config.ts ───────────────────────────────────────────
cat > next.config.ts << 'NEXTCONFIG'
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
  },
}

module.exports = nextConfig
NEXTCONFIG
echo "✓ next.config.ts"

# ── tsconfig.json ────────────────────────────────────────────
cat > tsconfig.json << 'TSCONFIG'
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
TSCONFIG
echo "✓ tsconfig.json"

# ── tailwind.config.ts ───────────────────────────────────────
cat > tailwind.config.ts << 'TAILWIND'
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          500: '#4f6ef7',
          600: '#3d5ce8',
          700: '#2d4bce',
          900: '#1a2d7a',
        },
      },
    },
  },
  plugins: [],
}

export default config
TAILWIND
echo "✓ tailwind.config.ts"

# ── postcss.config.js ────────────────────────────────────────
cat > postcss.config.js << 'POSTCSS'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
POSTCSS
echo "✓ postcss.config.js"

# ── .env.local.example ───────────────────────────────────────
cat > .env.local.example << 'ENVEXAMPLE'
# CodeCompanion — Environment Variables
# Copy this to .env.local and fill in your values
# Never commit .env.local to GitHub

# Supabase (you already have this)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Clerk — https://dashboard.clerk.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Anthropic — https://console.anthropic.com (sign BAA before production)
ANTHROPIC_API_KEY=sk-ant-...

# Stripe — https://dashboard.stripe.com
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Inngest — https://app.inngest.com
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...

# Athena — https://docs.athenahealth.com
# Keep ATHENA_USE_MOCK=true until you have real credentials
ATHENA_CLIENT_ID=
ATHENA_CLIENT_SECRET=
ATHENA_BASE_URL=https://api.preview.platform.athenahealth.com
ATHENA_USE_MOCK=true
ENVEXAMPLE
echo "✓ .env.local.example"

# ── README.md ────────────────────────────────────────────────
cat > README.md << 'README'
# CodeCompanion

AI-powered coding and revenue intelligence for independent primary care practices.

## What it does

- **Coding suggester** — reads your encounter note, suggests E&M + ICD-10 + CPT, you approve, pushes to Athena
- **Coding audit** — flags undercoding and upcoding risk
- **Care gap scanner** — surfaces AWV, CCM, HCC recapture, quality measures
- **Audit shield** — RAC/OIG risk scoring and documentation gap detection
- **No-show predictor** — scores your morning schedule before your first patient

## Stack

Next.js 14 · Supabase · Clerk · Inngest · Claude API · Stripe · Athena EHR

## Setup

```bash
cp .env.local.example .env.local
# Fill in your Supabase keys
npm install
npm run dev
```

Run the migration in Supabase SQL editor:
`supabase/migrations/001_initial_schema.sql`

See `CLAUDE.md` for full build roadmap.
README
echo "✓ README.md"

# ── supabase/migrations/001_initial_schema.sql ───────────────
cat > supabase/migrations/001_initial_schema.sql << 'SQL'
-- CodeCompanion Initial Schema
create extension if not exists "uuid-ossp";

-- Core tables
create table practices (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  athena_practice_id text,
  subscription_tier text not null default 'starter'
    check (subscription_tier in ('starter','professional','group')),
  created_at timestamptz not null default now()
);

create table practice_users (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,
  clerk_user_id text not null unique,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now()
);

create table athena_connections (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade unique,
  access_token_encrypted text,
  refresh_token_encrypted text,
  expires_at timestamptz,
  scope text,
  connected_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade unique,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  tier text not null default 'starter',
  status text not null default 'trialing',
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table sync_jobs (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,
  job_type text not null,
  status text not null default 'pending'
    check (status in ('pending','running','completed','failed')),
  started_at timestamptz,
  completed_at timestamptz,
  records_processed int default 0,
  error text,
  created_at timestamptz not null default now()
);

-- Intelligence tables
create table coding_suggestions (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,
  athena_encounter_id text not null,
  athena_patient_id text not null,
  encounter_date date not null,
  suggested_em_level text,
  suggested_icd10_codes jsonb default '[]',
  suggested_cpt_codes jsonb default '[]',
  suggested_modifiers jsonb default '[]',
  confidence numeric(3,2) default 0,
  reasoning text,
  status text not null default 'pending'
    check (status in ('pending','approved','edited','rejected')),
  provider_edited_codes jsonb,
  approved_at timestamptz,
  claude_model text,
  prompt_tokens int,
  completion_tokens int,
  created_at timestamptz not null default now(),
  unique(practice_id, athena_encounter_id)
);

create table encounter_flags (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,
  athena_encounter_id text not null,
  athena_patient_id text not null,
  encounter_date date not null,
  flag_type text not null
    check (flag_type in ('undercoding','upcoding_risk','wrong_code','modifier_issue','documentation_gap')),
  billed_code text not null,
  suggested_code text,
  revenue_delta numeric(10,2) default 0,
  confidence numeric(3,2) default 0,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table care_gaps (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,
  athena_patient_id text not null,
  gap_type text not null
    check (gap_type in ('awv','ccm_enrollment','hcc_recapture','quality_measure','overdue_lab','immunization','screening','depression_screening')),
  gap_code text,
  estimated_revenue numeric(10,2) default 0,
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  identified_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table audit_risks (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,
  risk_type text not null
    check (risk_type in ('upcoding_pattern','modifier_overuse','documentation_gap','rac_target','oig_watchlist')),
  severity text not null default 'medium' check (severity in ('high','medium','low')),
  code text,
  rate_actual numeric(5,4),
  rate_benchmark numeric(5,4),
  affected_count int default 0,
  description text,
  identified_at timestamptz not null default now(),
  resolved boolean not null default false
);

create table schedule_risks (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,
  athena_appointment_id text not null,
  athena_patient_id text not null,
  no_show_probability numeric(3,2) not null,
  appointment_date date not null,
  appointment_time time,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table billing_patterns (
  id uuid primary key default uuid_generate_v4(),
  practice_id uuid not null references practices(id) on delete cascade,
  period_month date not null,
  code text not null,
  claim_count int default 0,
  avg_allowed numeric(10,2),
  peer_benchmark_rate numeric(5,4),
  created_at timestamptz not null default now(),
  unique(practice_id, period_month, code)
);

-- Indexes
create index idx_coding_suggestions_practice on coding_suggestions(practice_id);
create index idx_coding_suggestions_status on coding_suggestions(practice_id, status);
create index idx_encounter_flags_practice on encounter_flags(practice_id, resolved);
create index idx_care_gaps_practice on care_gaps(practice_id, resolved_at);
create index idx_audit_risks_practice on audit_risks(practice_id, resolved);
create index idx_schedule_risks_date on schedule_risks(practice_id, appointment_date);
create index idx_practice_users_clerk on practice_users(clerk_user_id);

-- Row Level Security
alter table practices enable row level security;
alter table practice_users enable row level security;
alter table athena_connections enable row level security;
alter table subscriptions enable row level security;
alter table sync_jobs enable row level security;
alter table coding_suggestions enable row level security;
alter table encounter_flags enable row level security;
alter table care_gaps enable row level security;
alter table audit_risks enable row level security;
alter table schedule_risks enable row level security;
alter table billing_patterns enable row level security;

create or replace function get_user_practice_id()
returns uuid language sql security definer as $$
  select practice_id from practice_users
  where clerk_user_id = current_setting('app.clerk_user_id', true)
  limit 1;
$$;

create policy "own practice only" on practices for all using (id = get_user_practice_id());
create policy "own practice only" on practice_users for all using (practice_id = get_user_practice_id());
create policy "own practice only" on athena_connections for all using (practice_id = get_user_practice_id());
create policy "own practice only" on subscriptions for all using (practice_id = get_user_practice_id());
create policy "own practice only" on sync_jobs for all using (practice_id = get_user_practice_id());
create policy "own practice only" on coding_suggestions for all using (practice_id = get_user_practice_id());
create policy "own practice only" on encounter_flags for all using (practice_id = get_user_practice_id());
create policy "own practice only" on care_gaps for all using (practice_id = get_user_practice_id());
create policy "own practice only" on audit_risks for all using (practice_id = get_user_practice_id());
create policy "own practice only" on schedule_risks for all using (practice_id = get_user_practice_id());
create policy "own practice only" on billing_patterns for all using (practice_id = get_user_practice_id());
SQL
echo "✓ supabase/migrations/001_initial_schema.sql"

# ── lib/athena/types.ts ──────────────────────────────────────
cat > lib/athena/types.ts << 'TYPES'
export interface AthenaEncounterNote {
  encounterid: string
  patientid: string
  encounterdate: string
  encountertype: string
  notetext: string
  lockeddate?: string
  providerid: string
}

export interface AthenaEncounterDiagnosis {
  icd10code: string
  description: string
  diagnosisorder: number
}

export interface AthenaEncounterProcedure {
  cptcode: string
  modifier?: string
  description: string
  units: number
}

export interface AthenaAppointment {
  appointmentid: string
  patientid: string
  appointmentdate: string
  appointmenttime: string
  appointmenttype: string
  status: string
  providerid: string
}

export interface AthenaPatientProblem {
  icd10code: string
  description: string
  status: string
  onsetdate?: string
}

export interface AthenaPatient {
  patientid: string
  age: number
  sex: string
  primaryinsurancetype: string
  problems: AthenaPatientProblem[]
  lastawvdate?: string
  ccmenrolled?: boolean
  lastlabdates?: Record<string, string>
}

export interface AthenaClaim {
  claimid: string
  encounterid: string
  patientid: string
  servicedate: string
  primarydiagnosiscode: string
  procedurecode: string
  modifier?: string
  billedamount: number
  allowedamount?: number
  status: string
}

export interface CodeSuggestion {
  emLevel: string
  icd10Codes: Array<{ code: string; description: string; confidence: number }>
  cptCodes: Array<{ code: string; description: string; units: number }>
  modifiers: Array<{ modifier: string; reason: string }>
  confidence: number
  reasoning: string
  mdmLevel?: 'straightforward' | 'low' | 'moderate' | 'high'
  timeMinutes?: number
}

export interface AthenaClient {
  getEncounterNote(practiceId: string, encounterId: string): Promise<AthenaEncounterNote>
  getEncounterDiagnoses(practiceId: string, encounterId: string): Promise<AthenaEncounterDiagnosis[]>
  getEncounterProcedures(practiceId: string, encounterId: string): Promise<AthenaEncounterProcedure[]>
  postEncounterDiagnoses(practiceId: string, encounterId: string, diagnoses: AthenaEncounterDiagnosis[]): Promise<void>
  postEncounterProcedures(practiceId: string, encounterId: string, procedures: AthenaEncounterProcedure[]): Promise<void>
  getAppointments(practiceId: string, date: string): Promise<AthenaAppointment[]>
  getPatient(practiceId: string, patientId: string): Promise<AthenaPatient>
  getPatientAppointmentHistory(practiceId: string, patientId: string): Promise<AthenaAppointment[]>
  getClaims(practiceId: string, dateFrom: string, dateTo: string): Promise<AthenaClaim[]>
  getCCMPatients(practiceId: string): Promise<AthenaPatient[]>
}
TYPES
echo "✓ lib/athena/types.ts"

# ── lib/athena/index.ts ──────────────────────────────────────
cat > lib/athena/index.ts << 'ATHENAINDEX'
import { mockClient } from './mock-client'
import { realClient } from './client'
import type { AthenaClient } from './types'

export const athenaClient: AthenaClient =
  process.env.ATHENA_USE_MOCK === 'true' ? mockClient : realClient

export * from './types'
ATHENAINDEX
echo "✓ lib/athena/index.ts"

# ── lib/athena/client.ts (real client stub) ──────────────────
cat > lib/athena/client.ts << 'REALCLIENT'
// Real Athena API client — implement when credentials are ready
// See CLAUDE.md for endpoint reference

import type { AthenaClient } from './types'

const BASE_URL = process.env.ATHENA_BASE_URL ?? 'https://api.preview.platform.athenahealth.com'

async function getAccessToken(practiceId: string): Promise<string> {
  // TODO: fetch from athena_connections, refresh if expired
  throw new Error('TODO: implement getAccessToken')
}

export const realClient: AthenaClient = {
  async getEncounterNote(practiceId, encounterId) {
    throw new Error('TODO: GET /v1/{practiceid}/encounters/{encounterid}/notes')
  },
  async getEncounterDiagnoses(practiceId, encounterId) {
    throw new Error('TODO: GET /v1/{practiceid}/encounters/{encounterid}/diagnoses')
  },
  async getEncounterProcedures(practiceId, encounterId) {
    throw new Error('TODO: GET /v1/{practiceid}/encounters/{encounterid}/procedures')
  },
  async postEncounterDiagnoses(practiceId, encounterId, diagnoses) {
    throw new Error('TODO: POST /v1/{practiceid}/encounters/{encounterid}/diagnoses')
  },
  async postEncounterProcedures(practiceId, encounterId, procedures) {
    throw new Error('TODO: POST /v1/{practiceid}/encounters/{encounterid}/procedures')
  },
  async getAppointments(practiceId, date) {
    throw new Error('TODO: GET /v1/{practiceid}/appointments/booked')
  },
  async getPatient(practiceId, patientId) {
    throw new Error('TODO: GET /v1/{practiceid}/patients/{patientid}')
  },
  async getPatientAppointmentHistory(practiceId, patientId) {
    throw new Error('TODO: GET /v1/{practiceid}/patients/{patientid}/appointments')
  },
  async getClaims(practiceId, dateFrom, dateTo) {
    throw new Error('TODO: GET /v1/{practiceid}/claims')
  },
  async getCCMPatients(practiceId) {
    throw new Error('TODO: GET /v1/{practiceid}/patients/ccm')
  },
}
REALCLIENT
echo "✓ lib/athena/client.ts"

# ── lib/athena/mock-client.ts ────────────────────────────────
cat > lib/athena/mock-client.ts << 'MOCKCLIENT'
// Mock Athena client with realistic primary care synthetic data
import type { AthenaClient, AthenaPatient, AthenaEncounterNote, AthenaAppointment, AthenaClaim } from './types'

const MOCK_PATIENTS: AthenaPatient[] = [
  {
    patientid: 'P001', age: 68, sex: 'M', primaryinsurancetype: 'Medicare',
    problems: [
      { icd10code: 'I10', description: 'Essential hypertension', status: 'active' },
      { icd10code: 'E11.9', description: 'Type 2 diabetes mellitus', status: 'active' },
      { icd10code: 'E78.5', description: 'Hyperlipidemia', status: 'active' },
    ],
    lastawvdate: '2023-03-15', ccmenrolled: false,
    lastlabdates: { HbA1c: '2024-01-10', Lipids: '2024-01-10' },
  },
  {
    patientid: 'P002', age: 74, sex: 'F', primaryinsurancetype: 'Medicare',
    problems: [
      { icd10code: 'I50.9', description: 'Heart failure, unspecified', status: 'active' },
      { icd10code: 'I10', description: 'Essential hypertension', status: 'active' },
      { icd10code: 'N18.3', description: 'Chronic kidney disease, stage 3', status: 'active' },
      { icd10code: 'E11.9', description: 'Type 2 diabetes mellitus', status: 'active' },
    ],
    lastawvdate: '2024-11-20', ccmenrolled: false,
    lastlabdates: { HbA1c: '2024-09-01' },
  },
  {
    patientid: 'P003', age: 55, sex: 'M', primaryinsurancetype: 'Commercial',
    problems: [
      { icd10code: 'J44.1', description: 'COPD with acute exacerbation', status: 'active' },
      { icd10code: 'I10', description: 'Essential hypertension', status: 'active' },
    ],
    lastlabdates: {},
  },
  {
    patientid: 'P004', age: 71, sex: 'F', primaryinsurancetype: 'Medicare',
    problems: [
      { icd10code: 'M05.9', description: 'Rheumatoid arthritis', status: 'active' },
      { icd10code: 'E11.9', description: 'Type 2 diabetes mellitus', status: 'active' },
    ],
    lastawvdate: '2025-01-10', ccmenrolled: true,
    lastlabdates: { HbA1c: '2024-10-15' },
  },
  {
    patientid: 'P005', age: 45, sex: 'F', primaryinsurancetype: 'Commercial',
    problems: [
      { icd10code: 'F32.1', description: 'Major depressive disorder, moderate', status: 'active' },
      { icd10code: 'F41.1', description: 'Generalized anxiety disorder', status: 'active' },
    ],
    lastlabdates: {},
  },
  {
    patientid: 'P006', age: 62, sex: 'M', primaryinsurancetype: 'Medicare',
    problems: [
      { icd10code: 'I10', description: 'Essential hypertension', status: 'active' },
      { icd10code: 'E78.5', description: 'Hyperlipidemia', status: 'active' },
    ],
    lastawvdate: '2023-08-05', ccmenrolled: false,
    lastlabdates: { Lipids: '2023-08-05' },
  },
  {
    patientid: 'P009', age: 66, sex: 'F', primaryinsurancetype: 'Medicare',
    problems: [
      { icd10code: 'E11.65', description: 'T2DM with hyperglycemia', status: 'active' },
      { icd10code: 'I10', description: 'Essential hypertension', status: 'active' },
    ],
    lastawvdate: '2024-12-01', ccmenrolled: false,
    lastlabdates: { HbA1c: '2024-06-01' },
  },
]

const MOCK_NOTES: Record<string, AthenaEncounterNote> = {
  'E001': {
    encounterid: 'E001', patientid: 'P001',
    encounterdate: '2026-05-03', encountertype: 'Office Visit', providerid: 'DR001',
    notetext: `CHIEF COMPLAINT: Follow-up for diabetes and hypertension.

HISTORY OF PRESENT ILLNESS:
Mr. Johnson is a 68-year-old male with type 2 diabetes, hypertension, and hyperlipidemia presenting for routine follow-up. Home glucose readings 140-180 mg/dL fasting, up from 110-130. Reports new bilateral foot tingling since last visit. BP well controlled on current regimen. Diet less adherent over holidays.

MEDICATIONS: Metformin 1000mg BID, Lisinopril 10mg daily, Atorvastatin 40mg daily, Aspirin 81mg daily.

REVIEW OF SYSTEMS: Bilateral foot tingling. Denies chest pain, polyuria, visual changes.

PHYSICAL EXAM:
Vitals: BP 138/82, HR 74, Wt 198 lbs, BMI 29.4
Cardiovascular: RRR, no murmurs
Extremities: Bilateral decreased monofilament sensation plantar surface. No edema.

ASSESSMENT AND PLAN:
1. Type 2 diabetes with new peripheral neuropathy:
   - HbA1c ordered
   - Starting gabapentin 100mg TID
   - Podiatry referral placed
   - Consider GLP-1 if HbA1c > 8.5%
2. Hypertension: well controlled, continue regimen
3. Hyperlipidemia: lipid panel ordered

Total time: 35 minutes (10 min pre-visit review, 20 min face-to-face, 5 min documentation).`,
  },
  'E002': {
    encounterid: 'E002', patientid: 'P002',
    encounterdate: '2026-05-03', encountertype: 'Office Visit', providerid: 'DR001',
    notetext: `CHIEF COMPLAINT: Worsening shortness of breath x 2 weeks.

HISTORY OF PRESENT ILLNESS:
Mrs. Chen is a 74-year-old female with heart failure (EF 35%), hypertension, CKD stage 3, and T2DM presenting with progressive dyspnea on exertion over 2 weeks. Now limited to half block, down from 2 blocks. 4 lb weight gain over 5 days. 2-pillow orthopnea, occasional PND. Salty food at family gathering last week.

MEDICATIONS: Carvedilol 12.5mg BID, Lisinopril 5mg daily, Furosemide 40mg daily, Spironolactone 25mg daily, Metformin 500mg BID, Atorvastatin 40mg.

PHYSICAL EXAM:
Vitals: BP 152/90, HR 88, RR 18, O2 Sat 94% RA, Wt 174 lbs (+4 lbs)
JVD present at 45 degrees. S3 gallop. Bibasilar crackles to mid-lung. 2+ pitting edema to knees.

LABS: BMP last week — Cr 1.6 (baseline), K+ 4.2

ASSESSMENT AND PLAN:
1. Acute decompensated heart failure exacerbation:
   - Increase furosemide 80mg daily x 5 days
   - Daily weights, 2L fluid restriction, 2g sodium
   - BMP in 3 days
   - If no improvement 48-72 hours, admit
2. Hypertension: hold changes until euvolemic
3. CKD: monitor closely with diuresis
4. T2DM: stable

High complexity MDM: multiple chronic conditions with acute exacerbation, data review, decision re: hospitalization. Total time: 45 minutes.`,
  },
  'E003': {
    encounterid: 'E003', patientid: 'P005',
    encounterdate: '2026-05-03', encountertype: 'Office Visit', providerid: 'DR001',
    notetext: `CHIEF COMPLAINT: Depression/anxiety medication follow-up.

HISTORY OF PRESENT ILLNESS:
Ms. Williams is a 45-year-old female with MDD and GAD for 3-month medication follow-up. Mood "pretty good." PHQ-9 today 6 (mild), down from 12. Sleeping 7 hours, appetite improved, exercising 3x/week. Denies SI/HI.

MEDICATIONS: Sertraline 100mg daily, Buspirone 10mg BID.

PHYSICAL EXAM:
Vitals: BP 118/72, HR 68
Psychiatric: Affect appropriate, mood euthymic, speech normal.

ASSESSMENT AND PLAN:
1. MDD: improving, PHQ-9 6 from 12. Continue sertraline 100mg.
2. GAD: well controlled. Continue buspirone 10mg BID.
Return 3 months.`,
  },
}

const MOCK_APPOINTMENTS: AthenaAppointment[] = [
  { appointmentid: 'APPT001', patientid: 'P001', appointmentdate: '05/03/2026', appointmenttime: '09:00', appointmenttype: 'Follow-up', status: 'Scheduled', providerid: 'DR001' },
  { appointmentid: 'APPT002', patientid: 'P002', appointmentdate: '05/03/2026', appointmenttime: '10:00', appointmenttype: 'Urgent', status: 'Scheduled', providerid: 'DR001' },
  { appointmentid: 'APPT003', patientid: 'P005', appointmentdate: '05/03/2026', appointmenttime: '11:00', appointmenttype: 'Follow-up', status: 'Scheduled', providerid: 'DR001' },
  { appointmentid: 'APPT004', patientid: 'P003', appointmentdate: '05/03/2026', appointmenttime: '13:00', appointmenttype: 'Follow-up', status: 'Scheduled', providerid: 'DR001' },
  { appointmentid: 'APPT005', patientid: 'P006', appointmentdate: '05/03/2026', appointmenttime: '14:00', appointmenttype: 'Annual Physical', status: 'Scheduled', providerid: 'DR001' },
  { appointmentid: 'APPT006', patientid: 'P009', appointmentdate: '05/03/2026', appointmenttime: '15:00', appointmenttype: 'Follow-up', status: 'Scheduled', providerid: 'DR001' },
]

const MOCK_HISTORY: Record<string, AthenaAppointment[]> = {
  'P001': [
    { appointmentid: 'H100', patientid: 'P001', appointmentdate: '02/01/2026', appointmenttime: '09:00', appointmenttype: 'Follow-up', status: 'Arrived', providerid: 'DR001' },
    { appointmentid: 'H101', patientid: 'P001', appointmentdate: '11/15/2025', appointmenttime: '10:00', appointmenttype: 'Follow-up', status: 'Arrived', providerid: 'DR001' },
  ],
  'P002': [
    { appointmentid: 'H200', patientid: 'P002', appointmentdate: '01/10/2026', appointmenttime: '11:00', appointmenttype: 'Follow-up', status: 'No Show', providerid: 'DR001' },
    { appointmentid: 'H201', patientid: 'P002', appointmentdate: '10/05/2025', appointmenttime: '09:00', appointmenttype: 'Follow-up', status: 'No Show', providerid: 'DR001' },
  ],
  'P005': [
    { appointmentid: 'H500', patientid: 'P005', appointmentdate: '02/01/2026', appointmenttime: '13:00', appointmenttype: 'Follow-up', status: 'No Show', providerid: 'DR001' },
    { appointmentid: 'H501', patientid: 'P005', appointmentdate: '11/01/2025', appointmenttime: '09:00', appointmenttype: 'Follow-up', status: 'Arrived', providerid: 'DR001' },
  ],
}

const MOCK_CLAIMS: AthenaClaim[] = [
  { claimid: 'C001', encounterid: 'E001', patientid: 'P001', servicedate: '2026-05-03', primarydiagnosiscode: 'E11.9', procedurecode: '99213', billedamount: 92.00, status: 'submitted' },
  { claimid: 'C002', encounterid: 'E002', patientid: 'P002', servicedate: '2026-05-03', primarydiagnosiscode: 'I50.9', procedurecode: '99215', modifier: '25', billedamount: 211.00, status: 'submitted' },
  { claimid: 'C003', encounterid: 'E003', patientid: 'P005', servicedate: '2026-05-03', primarydiagnosiscode: 'F32.1', procedurecode: '99213', billedamount: 92.00, status: 'submitted' },
]

function delay(ms = 80) { return new Promise(r => setTimeout(r, ms)) }

export const mockClient: AthenaClient = {
  async getEncounterNote(practiceId, encounterId) {
    await delay()
    const note = MOCK_NOTES[encounterId]
    if (!note) throw new Error(`Mock: encounter ${encounterId} not found`)
    return note
  },
  async getEncounterDiagnoses(practiceId, encounterId) {
    await delay()
    const note = MOCK_NOTES[encounterId]
    if (!note) return []
    const patient = MOCK_PATIENTS.find(p => p.patientid === note.patientid)
    return (patient?.problems ?? []).map((p, i) => ({ icd10code: p.icd10code, description: p.description, diagnosisorder: i + 1 }))
  },
  async getEncounterProcedures(practiceId, encounterId) {
    await delay()
    const claim = MOCK_CLAIMS.find(c => c.encounterid === encounterId)
    if (!claim) return []
    return [{ cptcode: claim.procedurecode, modifier: claim.modifier, description: `CPT ${claim.procedurecode}`, units: 1 }]
  },
  async postEncounterDiagnoses(practiceId, encounterId, diagnoses) {
    await delay()
    console.log(`[MOCK] Posted ${diagnoses.length} diagnoses to encounter ${encounterId}`)
  },
  async postEncounterProcedures(practiceId, encounterId, procedures) {
    await delay()
    console.log(`[MOCK] Posted ${procedures.length} procedures to encounter ${encounterId}`)
  },
  async getAppointments(practiceId, date) { await delay(); return MOCK_APPOINTMENTS },
  async getPatient(practiceId, patientId) {
    await delay()
    const p = MOCK_PATIENTS.find(p => p.patientid === patientId)
    if (!p) throw new Error(`Mock: patient ${patientId} not found`)
    return p
  },
  async getPatientAppointmentHistory(practiceId, patientId) {
    await delay()
    return MOCK_HISTORY[patientId] ?? []
  },
  async getClaims(practiceId, dateFrom, dateTo) { await delay(); return MOCK_CLAIMS },
  async getCCMPatients(practiceId) {
    await delay()
    return MOCK_PATIENTS.filter(p => p.primaryinsurancetype === 'Medicare' && p.problems.length >= 2 && !p.ccmenrolled)
  },
}

export { MOCK_PATIENTS, MOCK_NOTES, MOCK_APPOINTMENTS, MOCK_CLAIMS }
MOCKCLIENT
echo "✓ lib/athena/mock-client.ts"

# ── lib/intelligence/coding-suggester.ts ─────────────────────
cat > lib/intelligence/coding-suggester.ts << 'SUGGESTER'
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
SUGGESTER
echo "✓ lib/intelligence/coding-suggester.ts"

# ── lib/supabase/server.ts ───────────────────────────────────
cat > lib/supabase/server.ts << 'SUPASERVER'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name, value, options) { cookieStore.set({ name, value, ...options }) },
        remove(name, options) { cookieStore.set({ name, value: '', ...options }) },
      },
    }
  )
}

// Service role client — bypasses RLS, use only in API routes
export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { get: () => undefined, set: () => {}, remove: () => {} } }
  )
}
SUPASERVER
echo "✓ lib/supabase/server.ts"

# ── lib/supabase/client.ts ───────────────────────────────────
cat > lib/supabase/client.ts << 'SUPACLIENT'
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
SUPACLIENT
echo "✓ lib/supabase/client.ts"

# ── inngest/client.ts ────────────────────────────────────────
cat > inngest/client.ts << 'INNGESTCLIENT'
import { Inngest } from 'inngest'

export const inngest = new Inngest({ id: 'codecompanion' })
INNGESTCLIENT
echo "✓ inngest/client.ts"

# ── app/globals.css ──────────────────────────────────────────
cat > app/globals.css << 'CSS'
@tailwind base;
@tailwind components;
@tailwind utilities;
CSS
echo "✓ app/globals.css"

# ── app/layout.tsx ───────────────────────────────────────────
cat > app/layout.tsx << 'ROOTLAYOUT'
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'CodeCompanion',
  description: 'AI-powered coding and revenue intelligence for primary care',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
ROOTLAYOUT
echo "✓ app/layout.tsx"

# ── app/api/inngest/route.ts ─────────────────────────────────
cat > app/api/inngest/route.ts << 'INNGESTROUTE'
import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'

// Import functions as they are built
// import { nightlySync } from '@/inngest/functions/nightly-sync'
// import { morningScore } from '@/inngest/functions/morning-score'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // nightlySync,
    // morningScore,
  ],
})
INNGESTROUTE
echo "✓ app/api/inngest/route.ts"

# ── Done ─────────────────────────────────────────────────────
echo ""
echo "✅ CodeCompanion Phase 1 setup complete!"
echo ""
echo "Next steps:"
echo "  1. cp .env.local.example .env.local"
echo "  2. Add your Supabase URL + keys to .env.local"
echo "  3. Run the SQL migration in Supabase dashboard"
echo "  4. npm install"
echo "  5. npm run dev"
echo ""
echo "Come back to chat for Phase 2 — the app shell + dashboard UI"