"use strict";
// backend/src/lookup-services/BTMSLookupServiceFactory.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@bsv/sdk");
const BTMSStorage_1 = require("./BTMSStorage");
const BTMSLookupDocs_md_1 = __importDefault(require("./BTMSLookupDocs.md"));
// @ts-ignore -- JS lib, no types
const pushdrop_1 = __importDefault(require("pushdrop"));
/**
 * BTMS lookup service:
 *  - Admit locking-script outputs and store minimal info.
 *  - Lookups MUST return a **PLAIN ARRAY** (engine maps over it).
 *    Here we return Meter-style rows:
 *      { txid, outputIndex, context?: number[] }
 *    where `context` holds AtomicBEEF bytes.
 */
class BTMSLookupService {
    constructor(storage) {
        this.storage = storage;
        this.admissionMode = 'locking-script';
        this.spendNotificationMode = 'none';
    }
    async getDocumentation() {
        return BTMSLookupDocs_md_1.default;
    }
    async getMetaData() {
        return {
            name: 'BTMS Lookup Service',
            shortDescription: 'Indexes BTMS/pushdrop UTXOs; supports findAll / by-asset / by-outpoint.'
        };
    }
    /**
     * Admit handler — only for locking-script mode.
     * Stores: { txid, outputIndex, assetId?, amount?, metadata?, beef?, lockingScript? }
     *
     * Core shape (txid, outputIndex, assetId, amount, metadata) stays the same
     * as your original 4 tokens. `beef` and `lockingScript` are additive.
     */
    async outputAdmittedByTopic(payload) {
        if (payload.mode !== 'locking-script')
            return;
        const { txid, outputIndex, lockingScript } = payload;
        // Optional pushdrop decode for assetId/amount/metadata
        let assetId;
        let amount;
        let metadata;
        // Optional extras for later (send/redemption)
        let lockingScriptBytes;
        let beef;
        try {
            // Normalise lockingScript to hex for pushdrop.decode
            const scriptHex = typeof lockingScript?.toHex === 'function'
                ? lockingScript.toHex()
                : Array.isArray(lockingScript)
                    ? sdk_1.Utils.toHex(lockingScript)
                    : String(lockingScript ?? '');
            // Preserve raw lockingScript bytes if overlay gave us an array
            if (Array.isArray(lockingScript)) {
                lockingScriptBytes = lockingScript.map(n => Number(n));
            }
            else if (lockingScript?.toBuffer instanceof Function) {
                const buf = lockingScript.toBuffer();
                lockingScriptBytes = Array.from(buf);
            }
            const decoded = pushdrop_1.default.decode({ script: scriptHex, fieldFormat: 'utf8' });
            if (decoded?.fields) {
                assetId = decoded.fields[0] != null ? String(decoded.fields[0]) : undefined;
                amount = decoded.fields[1] != null ? Number(decoded.fields[1]) : undefined;
                metadata = decoded.fields[2] != null ? String(decoded.fields[2]) : undefined;
            }
        }
        catch {
            // not pushdrop; ignore
        }
        // ---- Extract AtomicBEEF/context from the payload (if present) ----
        const anyPayload = payload;
        const beefSource = anyPayload.context ??
            anyPayload.outputContext ??
            anyPayload.beef ??
            anyPayload.atomicBeef;
        if (beefSource != null) {
            if (Array.isArray(beefSource)) {
                beef = beefSource.map((x) => Number(x));
            }
            else if (beefSource instanceof Uint8Array) {
                beef = Array.from(beefSource);
            }
            // (If the overlay uses some other binary type, we can extend this later.)
        }
        // Persist (BTMSStorage already supports these fields)
        await this.storage.saveOnAdmit({
            txid,
            outputIndex,
            assetId,
            amount,
            metadata,
            beef,
            lockingScript: lockingScriptBytes
        });
    }
    async outputSpent(_payload) {
        // no-op for now
    }
    async outputEvicted(_txid, _outputIndex) {
        // no-op for now
    }
    /**
     * IMPORTANT: Return a **plain array** for ALL code paths.
     * We normalize to Meter-style:
     *   { txid, outputIndex, context?: number[] }
     *
     * Overlay engine will wrap this in the usual HTTP JSON:
     *   { type: "output-list", outputs: [...] }
     * so your existing curl /lookup examples keep working.
     */
    async lookup(question) {
        // Normalize query shape (accept {service,query:{...}} or flat)
        const src = question;
        const q = src && typeof src.query === 'object' && src.query !== null ? src.query : src;
        // 1) Exact outpoint (Meter-style): { txid, vout }
        if (typeof q?.txid === 'string' && Number.isFinite(q?.vout)) {
            const txid = q.txid;
            const outputIndex = Number(q.vout);
            const doc = await this.storage.findByOutpoint(txid, outputIndex);
            if (!doc)
                return [];
            return [this.storage.toMeterStyleOutput(doc)];
        }
        // 2) Named formula or boolean flag
        const formula = typeof q?.formula === 'string' ? q.formula : q?.findAll ? 'findAll' : undefined;
        if (formula === 'findAll') {
            const docs = await this.storage.findAll();
            return docs.map(d => this.storage.toMeterStyleOutput(d));
        }
        if (formula === 'findByAssetId' || typeof q?.assetId === 'string') {
            const assetId = String(q.assetId ?? '');
            if (!assetId)
                return [];
            const docs = await this.storage.findByAssetId(assetId);
            return docs.map(d => this.storage.toMeterStyleOutput(d));
        }
        // Default: empty array
        return [];
    }
}
/** Factory */
exports.default = (db) => {
    return new BTMSLookupService(new BTMSStorage_1.BTMSStorage(db));
};
