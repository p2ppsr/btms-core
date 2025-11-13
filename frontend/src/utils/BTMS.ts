// src/utils/BTMS.ts
//
// Thin facade so the UI can import the btms singleton and helpers
// from a single place.

import * as btmsCoreModule from 'btms-core'

// Resolve the core singleton instance (default export) in a robust way.
// If for some reason there is no .default, fall back to the module object itself.
const btms: any =
  (btmsCoreModule as any).default ?? (btmsCoreModule as any)

// Core helper function defined as a named export in btms-core/src/btms/index.ts
const coreSendBTMSToken: any = (btmsCoreModule as any).sendBTMSToken

// Keep existing behaviour: default export acts like the singleton instance.
export default btms

// Named helper: delegate to the core helper (btms-core).
export async function sendBTMSToken(args: any): Promise<void> {
  if (typeof coreSendBTMSToken === 'function') {
    return coreSendBTMSToken(args)
  }

  // Fallback (shouldn’t normally happen, but keeps things robust
  // if bundles/types are temporarily out of sync).
  if (btms && typeof (btms as any).send === 'function') {
    return (btms as any).send(args)
  }

  throw new Error('sendBTMSToken is not available on btms-core')
}
