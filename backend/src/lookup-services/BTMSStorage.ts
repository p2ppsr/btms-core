import {
  AtomicBEEF,
  BEEF,
  Byte,
  ISOTimestampString,
  PositiveIntegerOrZero,
  SatoshiValue,
  TXIDHexString,
} from "@bsv/sdk";
import { Db, Collection, WithId } from "mongodb";

type LockingScriptBytes = Byte[];
type BeefBytes = AtomicBEEF; // semantically we expect AtomicBEEF here

type ByteLike = LockingScriptBytes | BeefBytes | BEEF | Uint8Array | Buffer;

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
  metadata?: unknown;

  // Optional raw material for future redemption / debugging
  lockingScript?: LockingScriptBytes;
  beef?: BeefBytes;
  output?: unknown;

  // Overlay-side timestamp of when we first saw this outpoint
  createdAt?: ISOTimestampString | Date;
}

/**
 * Normalize any byte-like value (Array, Uint8Array, Buffer) to Byte[].
 * This keeps older docs (that may have Buffers) compatible with new-world
 * code that expects plain Byte[] for beef/lockingScript.
 */
function normalizeBytes(
  value: ByteLike | null | undefined | unknown,
): Byte[] | undefined {
  if (value == null) return undefined;

  if (Array.isArray(value)) {
    return value.map((n) => Number(n) as Byte);
  }

  if (value instanceof Uint8Array) {
    return Array.from(value, (b) => Number(b) as Byte);
  }

  // Node.js Buffer case
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return Array.from(value as Buffer, (b) => Number(b) as Byte);
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
   * We also normalize beef/lockingScript into Byte[] to avoid
   * Buffer/Uint8Array sneaking into Mongo.
   */
  async saveOnAdmit(record: BTMSRecord): Promise<void> {
    const {
      txid,
      outputIndex,
      lockingScript: rawLockingScript,
      beef: rawBeef,
      ...rest
    } = record;

    const now: ISOTimestampString =
      new Date().toISOString() as ISOTimestampString;
    const createdAt: ISOTimestampString | Date =
      record.createdAt != null ? record.createdAt : now;

    const lockingScript = normalizeBytes(rawLockingScript) as
      | LockingScriptBytes
      | undefined;
    const beef = normalizeBytes(rawBeef) as BeefBytes | undefined;

    const toSet: BTMSRecord = {
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
   * see Byte[].
   */
  async findAll(): Promise<BTMSRecord[]> {
    const docs = await this.collection.find({}).toArray();
    return docs.map((d) => ({
      ...d,
      lockingScript: normalizeBytes(d.lockingScript) as
        | LockingScriptBytes
        | undefined,
      beef: normalizeBytes(d.beef) as BeefBytes | undefined,
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
      lockingScript: normalizeBytes(d.lockingScript) as
        | LockingScriptBytes
        | undefined,
      beef: normalizeBytes(d.beef) as BeefBytes | undefined,
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
    const doc = await this.collection.findOne({
      txid,
      outputIndex: vout as PositiveIntegerOrZero,
    });
    if (!doc) return null;
    return {
      ...doc,
      lockingScript: normalizeBytes(doc.lockingScript) as
        | LockingScriptBytes
        | undefined,
      beef: normalizeBytes(doc.beef) as BeefBytes | undefined,
    };
  }

  /**
   * Helper to return Meter-style output if we need it
   * (e.g. for a future "give me the BEEF for this outpoint" API).
   * Ensures context is a Byte[].
   */
  toMeterStyleOutput(doc: WithId<BTMSRecord>): {
    txid: TXIDHexString;
    outputIndex: PositiveIntegerOrZero;
    context?: Byte[];
  } {
    return {
      txid: doc.txid,
      outputIndex: doc.outputIndex,
      context: normalizeBytes(doc.beef),
    };
  }
}
