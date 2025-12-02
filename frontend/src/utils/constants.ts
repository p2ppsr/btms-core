interface Constants {}

let constants: Constants

export const OFFERED_TEXT = 'offer'
export const ACCEPTED_TEXT = 'accept'
export const AVAILABLE_TEXT = 'available'
export const REMAINDER_TEXT = 'remainder'

if (
  window.location.host.startsWith('localhost') ||
  window.location.host.startsWith('staging') ||
  process.env.NODE_ENV === 'development'
) {
  // local
  constants = {}
} else {
  // production
  constants = {}
}
// btms-core/frontend/src/utils/constants.ts

/**
 * Basket name used when asking the wallet for token UTXOs.
 * Your current code calls wallet.listOutputs({ basket: 'tokens', ... })
 * so we keep that as the canonical basket.
 */
export const TOKEN_BASKET = 'tokens'

/**
 * Canonical MessageBox name for BTMS token sends.
 * New sends should target THIS box.
 */
export const BTMS_CANONICAL_MESSAGE_BOX = 'btms-tokens'

/**
 * Older / ad-hoc names we’ve seen in earlier code or logs:
 * - 'tokens-box' (what the current runtime was using)
 * - 'tokens'     (obvious name people try)
 *
 * Keep these so the UI can still see older incoming tokens.
 */
export const BTMS_LEGACY_MESSAGE_BOXES = ['tokens-box', 'tokens']

/**
 * All message boxes BTMS should read from, in order.
 * UI code can import this and loop.
 * First item is the standardized one.
 */
export const BTMS_ALL_MESSAGE_BOXES = [BTMS_CANONICAL_MESSAGE_BOX, ...BTMS_LEGACY_MESSAGE_BOXES]

export default constants
