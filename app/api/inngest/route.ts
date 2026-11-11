import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { tebraNightlySync } from '@/inngest/functions/tebra-nightly-sync'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [tebraNightlySync],
})
