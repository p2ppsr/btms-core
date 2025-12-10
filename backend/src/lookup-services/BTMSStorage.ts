import { Db, Collection } from 'mongodb'
import { BTMSRecord, UTXOReference } from '../types.js'

/**
 * Simple BTMS storage for MongoDB.
 * Only stores txid, outputIndex, and assetId for efficient lookups.
 */
export class BTMSStorage {
  private readonly records: Collection<BTMSRecord>

  constructor(db: Db) {
    this.records = db.collection<BTMSRecord>('btms')
  }

  /**
   * Store a BTMS token record on admission.
   */
  async storeRecord(record: BTMSRecord): Promise<void> {
    await this.records.updateOne(
      { txid: record.txid, outputIndex: record.outputIndex },
      { $set: record },
      { upsert: true }
    )
  }

  /**
   * Delete a record when the output is spent.
   */
  async deleteRecord(txid: string, outputIndex: number): Promise<void> {
    await this.records.deleteOne({ txid, outputIndex })
  }

  /**
   * Find records by assetId.
   */
  async findByAssetId(assetId: string): Promise<UTXOReference[]> {
    const docs = await this.records.find({ assetId }).toArray()
    return docs.map(d => ({ txid: d.txid, outputIndex: d.outputIndex }))
  }

  /**
   * Find a specific record by outpoint.
   */
  async findByOutpoint(txid: string, outputIndex: number): Promise<UTXOReference | null> {
    const doc = await this.records.findOne({ txid, outputIndex })
    if (!doc) return null
    return { txid: doc.txid, outputIndex: doc.outputIndex }
  }

  /**
   * Find all records (use sparingly).
   */
  async findAll(): Promise<UTXOReference[]> {
    const docs = await this.records.find({}).toArray()
    return docs.map(d => ({ txid: d.txid, outputIndex: d.outputIndex }))
  }
}
