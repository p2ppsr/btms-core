import { Db, WithId } from 'mongodb';
/**
 * Basic BTMS record we store in Mongo.
 * Match the shape we actually see in Mongo Express:
 * - txid
 * - outputIndex
 * - assetId
 * plus our extra fields when we admit from overlay.
 */
export interface BTMSRecord {
    txid: string;
    outputIndex: number;
    assetId?: string;
    lockingScript?: number[];
    beef?: number[];
    output?: any;
    amount?: number;
    metadata?: any;
    createdAt?: string | Date;
}
export declare class BTMSStorage {
    private readonly collection;
    constructor(db: Db);
    /**
     * Upsert on admit.
     * Our overlay code gave us txid + outputIndex.
     */
    saveOnAdmit(record: BTMSRecord): Promise<void>;
    /**
     * Simple "show me everything".
     */
    findAll(): Promise<BTMSRecord[]>;
    /**
     * By assetId — you already had data like assetId: "jack".
     */
    findByAssetId(assetId: string): Promise<BTMSRecord[]>;
    /**
     * NEW: exact { txid, vout } lookup.
     * Note: our doc uses outputIndex, so map vout -> outputIndex.
     */
    findByOutpoint(txid: string, vout: number): Promise<BTMSRecord | null>;
    /**
     * Helper to return Meter-style output if we need it.
     */
    toMeterStyleOutput(doc: WithId<BTMSRecord>): {
        txid: string;
        outputIndex: number;
        context: number[] | undefined;
    };
}
