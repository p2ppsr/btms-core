"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@bsv/sdk");
const BTMSTopicDocs_md_1 = __importDefault(require("./BTMSTopicDocs.md"));
// JS lib, no types — same as in your btms-core
// if the overlay runtime already has this available, use that path
// @ts-ignore
const pushdrop_1 = __importDefault(require("pushdrop"));
/**
 * Admits outputs that look like BTMS / pushdrop token outputs.
 * Very similar in shape to BTMSTopicManager, but instead of parsing an sCrypt
 * contract, we just try pushdrop.decode(...) on each output script.
 */
class BTMSTopicManager {
    /**
     * Decide which outputs from the submitted tx should be admitted to this topic.
     */
    async identifyAdmissibleOutputs(beef, previousCoins) {
        const outputsToAdmit = [];
        try {
            const tx = sdk_1.Transaction.fromBEEF(beef);
            for (const [i, output] of tx.outputs.entries()) {
                try {
                    // Try to decode as pushdrop
                    const decoded = pushdrop_1.default.decode({
                        script: output.lockingScript.toHex(),
                        fieldFormat: 'utf8'
                    });
                    // Minimal sanity: need at least assetId + amount
                    if (Array.isArray(decoded.fields) &&
                        decoded.fields.length >= 2 &&
                        typeof decoded.fields[0] === 'string' &&
                        typeof decoded.fields[1] === 'string') {
                        // If you want to enforce “belongs to btms” via protocolID in pushdrop,
                        // you could check decoded.protocolID / decoded.keyID / decoded.counterparty here.
                        outputsToAdmit.push(i);
                    }
                }
                catch (_) {
                    // not a BTMS/pushdrop output — ignore
                    continue;
                }
            }
            if (outputsToAdmit.length === 0) {
                // like BTMSTopicManager, we can be permissive and not throw
                console.warn('BTMSTopicManager: no outputs admitted for this tx');
            }
        }
        catch (error) {
            const beefStr = JSON.stringify(beef, null, 2);
            throw new Error(`BTMSTopicManager: error identifying admissible outputs: ${error} beef:${beefStr}}`);
        }
        return {
            outputsToAdmit,
            coinsToRetain: previousCoins
        };
    }
    async getDocumentation() {
        return BTMSTopicDocs_md_1.default;
    }
    async getMetaData() {
        return {
            name: 'BTMS Topic Manager',
            shortDescription: 'Admits BTMS / pushdrop token outputs.'
        };
    }
}
exports.default = BTMSTopicManager;
