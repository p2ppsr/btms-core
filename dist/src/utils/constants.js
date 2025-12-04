"use strict";
// btms-core/utils/constants.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.BTMS_ALL_MESSAGE_BOXES = exports.BTMS_LEGACY_MESSAGE_BOXES = exports.BTMS_CANONICAL_MESSAGE_BOX = exports.TOKEN_BASKET = void 0;
/**
 * Basket name used when asking the wallet for token UTXOs.
 * Your logs show wallet.listOutputs({ basket: 'tokens', ... })
 * so we keep that as the canonical basket.
 */
exports.TOKEN_BASKET = 'tokens';
/**
 * Canonical MessageBox name for BTMS token sends.
 * New sends should target THIS box.
 */
exports.BTMS_CANONICAL_MESSAGE_BOX = 'btms-tokens';
/**
 * Older / ad-hoc names we’ve seen in the wild or in earlier code:
 * - 'tokens-box' (what your current runtime was using)
 * - 'tokens'     (obvious guess people will try)
 *
 * We keep these so the UI can still see older incoming tokens.
 */
exports.BTMS_LEGACY_MESSAGE_BOXES = ['tokens-box', 'tokens'];
/**
 * Convenience: all message boxes BTMS should read from, in order.
 * UI code can just import this and loop.
 * First item is the one we want to standardize on.
 */
exports.BTMS_ALL_MESSAGE_BOXES = [exports.BTMS_CANONICAL_MESSAGE_BOX, ...exports.BTMS_LEGACY_MESSAGE_BOXES];
