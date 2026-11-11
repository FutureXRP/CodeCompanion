import { NextResponse } from 'next/server'
import { isNeonConfigured } from '@/lib/db/config'
import { createClient } from '@/lib/supabase/server'
import { withService, withTenant } from '@/lib/db/sql'
import { resolveTenantId } from '@/lib/db/tenant'
import { updateTask } from '@/lib/db/operational-repo'
import type { TaskStatus } from '@/lib/tasks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUSES: TaskStatus[] = ['open', 'in_progress', 'done']

/** A human's edit to a Follow-up Queue task: status and/or owner. */
export async function PATCH(request: Request) {
  if (!isNeonConfigured()) return NextResponse.json({ error: 'Database not configured (DATABASE_URL).' }, { status: 400 })
  try {
    const body = (await request.json().catch(() => ({}))) as { id?: string; status?: string; assignee?: string | null }
    const id = (body.id ?? '').trim()
    const status = body.status as TaskStatus | undefined
    if (!id || (status !== undefined && !STATUSES.includes(status)) || (status === undefined && body.assignee === undefined)) {
      return NextResponse.json({ error: 'id plus a status (open | in_progress | done) and/or an assignee are required.' }, { status: 400 })
    }
    const authed = await createClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated. Please sign in.' }, { status: 401 })
    const tenantId = await withService((db) => resolveTenantId(db, user.id))
    if (!tenantId) return NextResponse.json({ error: 'No practice for this user yet.' }, { status: 403 })

    const assignee = body.assignee === undefined ? undefined : (body.assignee ?? '').toString().trim() || null
    const ok = await withTenant(tenantId, (db) => updateTask(db, tenantId, id, { status, assignee }))
    if (!ok) return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
    return NextResponse.json({ ok: true, id, status, assignee })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
