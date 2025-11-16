// btms-core/utils/constants.ts

/**
 * Basket name used when asking the wallet for token UTXOs.
 * Your logs show wallet.listOutputs({ basket: 'tokens', ... })
 * so we keep that as the canonical basket.
 */
export const TOKEN_BASKET = "tokens";

/**
 * Canonical MessageBox name for BTMS token sends.
 * New sends should target THIS box.
 */
export const BTMS_CANONICAL_MESSAGE_BOX = "btms-tokens";

/**
 * Older / ad-hoc names we’ve seen in the wild or in earlier code:
 * - 'tokens-box' (what your current runtime was using)
 * - 'tokens'     (obvious guess people will try)
 *
 * We keep these so the UI can still see older incoming tokens.
 */
export const BTMS_LEGACY_MESSAGE_BOXES = ["tokens-box", "tokens"];

/**
 * Convenience: all message boxes BTMS should read from, in order.
 * UI code can just import this and loop.
 * First item is the one we want to standardize on.
 */
export const BTMS_ALL_MESSAGE_BOXES = [
  BTMS_CANONICAL_MESSAGE_BOX,
  ...BTMS_LEGACY_MESSAGE_BOXES,
];
