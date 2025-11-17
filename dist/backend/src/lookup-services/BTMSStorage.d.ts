import { AtomicBEEF, Byte, ISOTimestampString, PositiveIntegerOrZero, SatoshiValue, TXIDHexString } from '@bsv/sdk';
import { Db, WithId } from 'mongodb';
type LockingScriptBytes = Byte[];
type BeefBytes = AtomicBEEF;
/**
 * Basic BTMS record we store in Mongo.
 *
 * This is **our** explicit overlay-side format, separate from the base
 * overlay index. It lets BTMS (and future new-world code) keep a minimal
 * snapshot of what was admitted, without trying to mirror everything the
 * core overlay stores internally.
 *
 * - txid / outputIndex: the UTXO identity at admit time
 * - assetId / amount / metadata: optional, for future convenience
 * - lockingScript / beef: optional raw bytes we may use later for redemption
 * - createdAt: when this record was first admitted (overlay-local time)
 */
export interface BTMSRecord {
    txid: TXIDHexString;
    outputIndex: PositiveIntegerOrZero;
    assetId?: string;
    amount?: SatoshiValue;
    metadata?: unknown;
    lockingScript?: LockingScriptBytes;
    beef?: BeefBytes;
    output?: unknown;
    createdAt?: ISOTimestampString | Date;
}
export declare class BTMSStorage {
    private readonly collection;
    constructor(db: Db);
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
    saveOnAdmit(record: BTMSRecord): Promise<void>;
    /**
     * Simple "show me everything".
     * We normalize beef/lockingScript on the way out so callers always
     * see Byte[].
     */
    findAll(): Promise<BTMSRecord[]>;
    /**
     * By assetId — this becomes useful once some code path
     * actually populates assetId on BTMSRecord.
     */
    findByAssetId(assetId: string): Promise<BTMSRecord[]>;
    /**
     * Exact { txid, vout } lookup.
     * Note: our doc uses outputIndex, so map vout -> outputIndex.
     * Normalizes beef/lockingScript on return.
     */
    findByOutpoint(txid: TXIDHexString, vout: number): Promise<BTMSRecord | null>;
    /**
     * Helper to return Meter-style output if we need it
     * (e.g. for a future "give me the BEEF for this outpoint" API).
     * Ensures context is a Byte[].
     */
    toMeterStyleOutput(doc: WithId<BTMSRecord>): {
        txid: TXIDHexString;
        outputIndex: PositiveIntegerOrZero;
        context?: Byte[];
    };
}
export {};
