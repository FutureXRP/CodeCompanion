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
