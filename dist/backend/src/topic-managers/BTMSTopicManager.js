"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@bsv/sdk");
const BTMSTopicDocs_md_1 = __importDefault(require("./BTMSTopicDocs.md"));
/**
 * BTMS Topic Manager (pushdrop-free).
 *
 * For the **original BTMS demo flow**, we do *not* try to parse or
 * validate the token structure here. We simply:
 *
 *  - Parse the BEEF into a Transaction
 *  - Admit all outputs (or as many as we can safely handle)
 *  - Let higher-level code / the wallet decide what is “really” BTMS
 *
 * This keeps the overlay running reliably and avoids any dependency
 * on the separate `pushdrop` package or BRC-48 conventions.
 */
class BTMSTopicManager {
    /**
     * Decide which outputs from the submitted tx should be admitted to this topic.
     * For the original BTMS behavior, we simply admit all outputs that parse OK.
     */
    async identifyAdmissibleOutputs(beef, previousCoins) {
        const outputsToAdmit = [];
        try {
            const tx = sdk_1.Transaction.fromBEEF(beef);
            // Original BTMS flow did not filter by protocol.
            // To avoid fragile assumptions (and external libs), we admit all outputs.
            for (const [i] of tx.outputs.entries()) {
                outputsToAdmit.push(i);
            }
            if (outputsToAdmit.length === 0) {
                // Stay permissive like Meter: warn but don't throw.
                console.warn('BTMSTopicManager: no outputs admitted for this tx');
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const beefStr = JSON.stringify(beef, null, 2);
            throw new Error(`BTMSTopicManager: error identifying admissible outputs: ${message} beef:${beefStr}}`);
        }
        return {
            outputsToAdmit: outputsToAdmit,
            coinsToRetain: previousCoins
        };
    }
    async getDocumentation() {
        return BTMSTopicDocs_md_1.default;
    }
    async getMetaData() {
        return {
            name: 'BTMS Topic Manager',
            shortDescription: 'Admits BTMS transaction outputs (no PushDrop).'
        };
    }
}
exports.default = BTMSTopicManager;
