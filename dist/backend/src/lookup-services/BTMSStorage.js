"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BTMSStorage = void 0;
/**
 * Normalize any byte-like value (Array, Uint8Array, Buffer) to Byte[].
 * This keeps older docs (that may have Buffers) compatible with new-world
 * code that expects plain Byte[] for beef/lockingScript.
 */
function normalizeBytes(value) {
    if (value == null)
        return undefined;
    if (Array.isArray(value)) {
        return value.map(n => Number(n));
    }
    if (value instanceof Uint8Array) {
        return Array.from(value, b => Number(b));
    }
    // Node.js Buffer case
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
        return Array.from(value, b => Number(b));
    }
    return undefined;
}
class BTMSStorage {
    constructor(db) {
        // IMPORTANT: match the collection name shown in Mongo Express
        // "BTMSRecords" (capital B, T, M, S, capital R)
        this.collection = db.collection('BTMSRecords');
    }
    /**
     * Upsert on admit.
     * Our overlay code gave us txid + outputIndex (plus any extras).
     *
     * If createdAt is not present, we stamp it here so we can see
     * when the overlay first admitted this UTXO.
     *
     * We also normalize beef/lockingScript into Byte[] to avoid
     * Buffer/Uint8Array sneaking into Mongo.
     */
    async saveOnAdmit(record) {
        const { txid, outputIndex, lockingScript: rawLockingScript, beef: rawBeef, ...rest } = record;
        const now = new Date().toISOString();
        const createdAt = record.createdAt != null ? record.createdAt : now;
        const lockingScript = normalizeBytes(rawLockingScript);
        const beef = normalizeBytes(rawBeef);
        const toSet = {
            ...rest,
            txid,
            outputIndex,
            createdAt,
            ...(lockingScript ? { lockingScript } : {}),
            ...(beef ? { beef } : {})
        };
        await this.collection.updateOne({ txid, outputIndex }, { $set: toSet }, { upsert: true });
    }
    /**
     * Simple "show me everything".
     * We normalize beef/lockingScript on the way out so callers always
     * see Byte[].
     */
    async findAll() {
        const docs = await this.collection.find({}).toArray();
        return docs.map(d => ({
            ...d,
            lockingScript: normalizeBytes(d.lockingScript),
            beef: normalizeBytes(d.beef)
        }));
    }
    /**
     * By assetId — this becomes useful once some code path
     * actually populates assetId on BTMSRecord.
     */
    async findByAssetId(assetId) {
        const docs = await this.collection.find({ assetId }).toArray();
        return docs.map(d => ({
            ...d,
            lockingScript: normalizeBytes(d.lockingScript),
            beef: normalizeBytes(d.beef)
        }));
    }
    /**
     * Exact { txid, vout } lookup.
     * Note: our doc uses outputIndex, so map vout -> outputIndex.
     * Normalizes beef/lockingScript on return.
     */
    async findByOutpoint(txid, vout) {
        const doc = await this.collection.findOne({
            txid,
            outputIndex: vout
        });
        if (!doc)
            return null;
        return {
            ...doc,
            lockingScript: normalizeBytes(doc.lockingScript),
            beef: normalizeBytes(doc.beef)
        };
    }
    /**
     * Helper to return Meter-style output if we need it
     * (e.g. for a future "give me the BEEF for this outpoint" API).
     * Ensures context is a Byte[].
     */
    toMeterStyleOutput(doc) {
        return {
            txid: doc.txid,
            outputIndex: doc.outputIndex,
            context: normalizeBytes(doc.beef)
        };
    }
}
exports.BTMSStorage = BTMSStorage;
