// src/utils/btmsBaskets.ts
//
// BTMS Basket Helpers
// --------------------
// • Today: BTMS uses NORMAL baskets only (never “p “), per BRC-99.
// • Future: defines a BTMS permission scheme (“p btms …”) but NEVER generated
//   unless explicitly requested by a wallet that supports it.
//
// ALWAYS SAFE for production BTMS.
//
// ---------------------------------------------------------------

/**
 * Generate a standard BTMS basket ID for storing UTXOs
 * belonging to a specific asset.
 *
 * VALID (BRC-98 compliant)
 *  - "btms/asset/<assetId>"
 */
export function btmsAssetBasket(assetId: string): string {
  return `btms/asset/${assetId}`;
}

/**
 * Generate a counterparty-specific BTMS basket.
 *
 * VALID (BRC-98 compliant)
 *  - "btms/counterparty/<identityKey>/<assetId>"
 */
export function btmsCounterpartyBasket(
  identityKey: string,
  assetId: string,
): string {
  return `btms/counterparty/${identityKey}/${assetId}`;
}

/**
 * Generate a BTMS offer basket (used for marketplace-style offers).
 *
 * VALID (BRC-98)
 *  - "btms/offers/<uuid>"
 */
export function btmsOfferBasket(offerId: string): string {
  return `btms/offers/${offerId}`;
}

/* ================================================================
   FUTURE BRC-99: BTMS PERMISSION SCHEME BASKETS (NOT USED TODAY)
   --------------------------------------------------------------
   
   BRC-99 says:
   • Basket IDs beginning with "p " are RESERVED.
   • Wallets MUST reject them unless they implement the scheme.
   • Format: "p <schemeId> <rest>"
   • schemeId CANNOT contain spaces.

   We define the future BTMS permission-scheme:

      schemeId = "btms"

   Full form:
      "p btms <scope>/<counterparty>/<conditions>"

   NOTE:
   THESE MUST NOT BE USED UNTIL the wallet supports them.
   ================================================================ */

/**
 * Create a **future** BTMS permission-scheme basket ID.
 *
 * This should only be used by advanced MND integrations
 * once the Metanet client implements P-schemes.
 *
 * Example:
 *  p btms with/aliceKey/dailyLimit10
 */
export function btmsFuturePermissionBasket(rest: string): string {
  // enforce BRC-99 rules:
  if (rest.includes("\n")) {
    throw new Error("Invalid BTMS P-basket: cannot contain newline");
  }
  return `p btms ${rest}`;
}

/**
 * Detect whether a given basket ID is a BRC-99 P-scheme basket.
 */
export function isPschemeBasket(basket: string): boolean {
  return basket.startsWith("p ");
}

/**
 * Parse a P-scheme basket into { schemeId, rest }
 *
 * Only for future use by wallets. BTMS should NOT parse these
 * during normal operation because BTMS does not generate "p " baskets today.
 */
export function parsePschemeBasket(basket: string): {
  schemeId: string;
  rest: string;
} | null {
  if (!basket.startsWith("p ")) return null;

  // Format: p <schemeId> <rest>
  const parts = basket.split(" ");
  if (parts.length < 3) return null;

  const schemeId = parts[1];
  const rest = parts.slice(2).join(" ");

  return { schemeId, rest };
}
