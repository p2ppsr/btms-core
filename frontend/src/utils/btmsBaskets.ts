// src/utils/btmsBaskets.ts
//
// BTMS Basket Helpers
// --------------------
// BTMS uses BRC-99 permissioned baskets with "p btms" prefix.
// This ensures wallet permission modules can enforce access control.
//
// Token basket format: "p btms <assetId>"
// Example: "p btms MyToken123"
// ---------------------------------------------------------------

/** Permission scheme ID for BTMS (BRC-99 compliant) */
const BTMS_SCHEME_ID = 'btms'

/** Permissioned basket prefix */
const P_BASKET_PREFIX = `p ${BTMS_SCHEME_ID}`

/**
 * Generate a permissioned BTMS basket ID for storing token UTXOs.
 * Uses BRC-99 "p btms" prefix for wallet permission enforcement.
 *
 * Format: "p btms <assetId>"
 * Example: "p btms MyToken123"
 */
export function btmsAssetBasket(assetId: string): string {
  return `${P_BASKET_PREFIX} ${assetId}`
}

/**
 * Generate a counterparty-specific BTMS basket.
 * Uses BRC-99 "p btms" prefix for wallet permission enforcement.
 *
 * Format: "p btms counterparty/<identityKey>/<assetId>"
 */
export function btmsCounterpartyBasket(identityKey: string, assetId: string): string {
  return `${P_BASKET_PREFIX} counterparty/${identityKey}/${assetId}`
}

/**
 * Generate a BTMS offer basket (used for marketplace-style offers).
 * Uses BRC-99 "p btms" prefix for wallet permission enforcement.
 *
 * Format: "p btms offers/<uuid>"
 */
export function btmsOfferBasket(offerId: string): string {
  return `${P_BASKET_PREFIX} offers/${offerId}`
}

/**
 * Create a custom BTMS permission-scheme basket ID.
 *
 * Format: "p btms <rest>"
 * Example: "p btms with/aliceKey/dailyLimit10"
 */
export function btmsPermissionBasket(rest: string): string {
  // enforce BRC-99 rules:
  if (rest.includes('\n')) {
    throw new Error('Invalid BTMS P-basket: cannot contain newline')
  }
  return `${P_BASKET_PREFIX} ${rest}`
}

/**
 * Detect whether a given basket ID is a BRC-99 P-scheme basket.
 */
export function isPschemeBasket(basket: string): boolean {
  return basket.startsWith('p ')
}

/**
 * Parse a P-scheme basket into { schemeId, rest }
 *
 * Useful for wallet permission modules to extract the scheme ID
 * and remaining basket path from a permissioned basket.
 */
export function parsePschemeBasket(basket: string): {
  schemeId: string
  rest: string
} | null {
  if (!basket.startsWith('p ')) return null

  // Format: p <schemeId> <rest>
  const parts = basket.split(' ')
  if (parts.length < 3) return null

  const schemeId = parts[1]
  const rest = parts.slice(2).join(' ')

  return { schemeId, rest }
}
