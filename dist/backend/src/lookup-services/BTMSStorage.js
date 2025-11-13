"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BTMSStorage = void 0;
class BTMSStorage {
    constructor(db) {
        // IMPORTANT: match the collection name shown in Mongo Express
        // "BTMSRecords" (capital B, T, M, S, capital R)
        this.collection = db.collection('BTMSRecords');
    }
    /**
     * Upsert on admit.
     * Our overlay code gave us txid + outputIndex.
     */
    async saveOnAdmit(record) {
        const { txid, outputIndex, ...rest } = record;
        await this.collection.updateOne({ txid, outputIndex }, {
            $set: {
                txid,
                outputIndex,
                ...rest
            }
        }, { upsert: true });
    }
    /**
     * Simple "show me everything".
     */
    async findAll() {
        return this.collection.find({}).toArray();
    }
    /**
     * By assetId — you already had data like assetId: "jack".
     */
    async findByAssetId(assetId) {
        return this.collection.find({ assetId }).toArray();
    }
    /**
     * NEW: exact { txid, vout } lookup.
     * Note: our doc uses outputIndex, so map vout -> outputIndex.
     */
    async findByOutpoint(txid, vout) {
        return this.collection.findOne({ txid, outputIndex: vout });
    }
    /**
     * Helper to return Meter-style output if we need it.
     */
    toMeterStyleOutput(doc) {
        return {
            txid: doc.txid,
            outputIndex: doc.outputIndex,
            context: doc.beef
        };
    }
}
exports.BTMSStorage = BTMSStorage;
