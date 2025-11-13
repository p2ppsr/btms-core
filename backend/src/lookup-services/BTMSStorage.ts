import { Db, Collection, WithId } from 'mongodb'

/**
 * Basic BTMS record we store in Mongo.
 * Match the shape we actually see in Mongo Express:
 * - txid
 * - outputIndex
 * - assetId
 * plus our extra fields when we admit from overlay.
 */
export interface BTMSRecord {
  txid: string
  // in your Mongo it's called outputIndex, not vout
  outputIndex: number
  assetId?: string
  // optional extras from overlay admit
  lockingScript?: number[]
  beef?: number[]
  output?: any
  // other fields that might already be there:
  amount?: number
  metadata?: any
  createdAt?: string | Date
}

export class BTMSStorage {
  private readonly collection: Collection<BTMSRecord>

  constructor(db: Db) {
    // IMPORTANT: match the collection name shown in Mongo Express
    // "BTMSRecords" (capital B, T, M, S, capital R)
    this.collection = db.collection<BTMSRecord>('BTMSRecords')
  }

  /**
   * Upsert on admit.
   * Our overlay code gave us txid + outputIndex.
   */
  async saveOnAdmit(record: BTMSRecord): Promise<void> {
    const { txid, outputIndex, ...rest } = record
    await this.collection.updateOne(
      { txid, outputIndex },
      {
        $set: {
          txid,
          outputIndex,
          ...rest
        }
      },
      { upsert: true }
    )
  }

  /**
   * Simple "show me everything".
   */
  async findAll(): Promise<BTMSRecord[]> {
    return this.collection.find({}).toArray()
  }

  /**
   * By assetId — you already had data like assetId: "jack".
   */
  async findByAssetId(assetId: string): Promise<BTMSRecord[]> {
    return this.collection.find({ assetId }).toArray()
  }

  /**
   * NEW: exact { txid, vout } lookup.
   * Note: our doc uses outputIndex, so map vout -> outputIndex.
   */
  async findByOutpoint(txid: string, vout: number): Promise<BTMSRecord | null> {
    return this.collection.findOne({ txid, outputIndex: vout })
  }

  /**
   * Helper to return Meter-style output if we need it.
   */
  toMeterStyleOutput(doc: WithId<BTMSRecord>) {
    return {
      txid: doc.txid,
      outputIndex: doc.outputIndex,
      context: doc.beef
    }
  }
}
