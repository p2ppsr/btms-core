import { PositiveIntegerOrZero, SatoshiValue, TXIDHexString } from "@bsv/sdk";
import { Db, Collection, WithId } from "mongodb";

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
  // In your Mongo it's called outputIndex, not vout
  outputIndex: PositiveIntegerOrZero;

  // Optional extras from overlay admit or future enrichment
  assetId?: string;
  amount?: SatoshiValue;
  metadata?: any;

  // Optional raw material for future redemption / debugging
  lockingScript?: number[];
  beef?: number[];
  output?: any;

  // Overlay-side timestamp of when we first saw this outpoint
  createdAt?: string | Date;
}

/**
 * Normalize any byte-like value (Array, Uint8Array, Buffer) to number[].
 * This keeps older docs (that may have Buffers) compatible with new-world
 * code that expects plain number[] for beef/lockingScript.
 */
function normalizeBytes(value: any): number[] | undefined {
  if (value == null) return undefined;

  if (Array.isArray(value)) {
    return value.map((n: any) => Number(n));
  }

  if (value instanceof Uint8Array) {
    return Array.from(value);
  }

  // Node.js Buffer case
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return Array.from(value as Buffer);
  }

  return undefined;
}

export class BTMSStorage {
  private readonly collection: Collection<BTMSRecord>;

  constructor(db: Db) {
    // IMPORTANT: match the collection name shown in Mongo Express
    // "BTMSRecords" (capital B, T, M, S, capital R)
    this.collection = db.collection<BTMSRecord>("BTMSRecords");
  }

  /**
   * Upsert on admit.
   * Our overlay code gave us txid + outputIndex (plus any extras).
   *
   * If createdAt is not present, we stamp it here so we can see
   * when the overlay first admitted this UTXO.
   *
   * We also normalize beef/lockingScript into number[] to avoid
   * Buffer/Uint8Array sneaking into Mongo.
   */
  async saveOnAdmit(record: BTMSRecord): Promise<void> {
    const { txid, outputIndex, ...rest } = record;

    const now = new Date().toISOString();
    const createdAt = record.createdAt != null ? record.createdAt : now;

    const lockingScript = normalizeBytes((rest as any).lockingScript);
    const beef = normalizeBytes((rest as any).beef);

    const toSet = {
      ...rest,
      txid,
      outputIndex,
      createdAt,
      ...(lockingScript ? { lockingScript } : {}),
      ...(beef ? { beef } : {}),
    };

    await this.collection.updateOne(
      { txid, outputIndex },
      { $set: toSet },
      { upsert: true },
    );
  }

  /**
   * Simple "show me everything".
   * We normalize beef/lockingScript on the way out so callers always
   * see number[].
   */
  async findAll(): Promise<BTMSRecord[]> {
    const docs = await this.collection.find({}).toArray();
    return docs.map((d) => ({
      ...d,
      lockingScript: normalizeBytes((d as any).lockingScript),
      beef: normalizeBytes((d as any).beef),
    }));
  }

  /**
   * By assetId — this becomes useful once some code path
   * actually populates assetId on BTMSRecord.
   */
  async findByAssetId(assetId: string): Promise<BTMSRecord[]> {
    const docs = await this.collection.find({ assetId }).toArray();
    return docs.map((d) => ({
      ...d,
      lockingScript: normalizeBytes((d as any).lockingScript),
      beef: normalizeBytes((d as any).beef),
    }));
  }

  /**
   * Exact { txid, vout } lookup.
   * Note: our doc uses outputIndex, so map vout -> outputIndex.
   * Normalizes beef/lockingScript on return.
   */
  async findByOutpoint(
    txid: TXIDHexString,
    vout: number,
  ): Promise<BTMSRecord | null> {
    const doc = await this.collection.findOne({ txid, outputIndex: vout });
    if (!doc) return null;
    return {
      ...doc,
      lockingScript: normalizeBytes((doc as any).lockingScript),
      beef: normalizeBytes((doc as any).beef),
    };
  }

  /**
   * Helper to return Meter-style output if we need it
   * (e.g. for a future "give me the BEEF for this outpoint" API).
   * Ensures context is a number[].
   */
  toMeterStyleOutput(doc: WithId<BTMSRecord>) {
    return {
      txid: doc.txid,
      outputIndex: doc.outputIndex,
      context: normalizeBytes((doc as any).beef),
    };
  }
}
