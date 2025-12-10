import {
  AdmissionMode,
  LookupService,
  LookupFormula,
  OutputAdmittedByTopic,
  OutputSpent,
  SpendNotificationMode
} from '@bsv/overlay'
import { PushDrop, Utils, LookupQuestion } from '@bsv/sdk'
import { Db } from 'mongodb'
import { BTMSStorage } from './BTMSStorage.js'
import docs from './BTMSLookupDocs.md.js'

/**
 * BTMS Lookup Service
 * 
 * Indexes BTMS PushDrop tokens by assetId for efficient lookups.
 * Follows the same pattern as UMP Lookup Service.
 */
class BTMSLookupService implements LookupService {
  readonly admissionMode: AdmissionMode = 'locking-script'
  readonly spendNotificationMode: SpendNotificationMode = 'none'

  private storage: BTMSStorage

  constructor(db: Db) {
    this.storage = new BTMSStorage(db)
  }

  async getDocumentation(): Promise<string> {
    return docs
  }

  async getMetaData(): Promise<{
    name: string
    shortDescription: string
    iconURL?: string
    version?: string
    informationURL?: string
  }> {
    return {
      name: 'BTMS Lookup Service',
      shortDescription: 'Lookup Service for BTMS (Basic Token Management System) tokens'
    }
  }

  /**
   * Handle output admission from the topic manager.
   * Decodes the BTMS PushDrop token and stores the assetId for lookup.
   */
  async outputAdmittedByTopic(payload: OutputAdmittedByTopic): Promise<void> {
    if (payload.mode !== 'locking-script') {
      throw new Error('Invalid payload mode')
    }

    const { txid, outputIndex, topic, lockingScript } = payload

    // Only process BTMS topic
    if (topic !== 'tm_btms') return

    try {
      // Decode the BTMS PushDrop token
      const result = PushDrop.decode(lockingScript)

      // BTMS tokens have 4 fields: assetId, amount, op, metadata
      if (result.fields.length < 4) {
        console.warn(`[BTMSLookupService] Invalid BTMS token: expected 4 fields, got ${result.fields.length}`)
        return
      }

      // Extract assetId from field 0, amount from field 1
      const assetId = Utils.toUTF8(result.fields[0])
      const amount = Number(Utils.toUTF8(result.fields[1]))

      // Store the record
      await this.storage.storeRecord({
        txid,
        outputIndex,
        assetId,
        amount
      })
    } catch (error) {
      // If we can't decode the PushDrop, skip silently
      // The topic manager should have already validated this
      console.warn(`[BTMSLookupService] Failed to decode PushDrop:`, error)
    }
  }

  /**
   * Handle output spend notification.
   * Removes the record from storage when the UTXO is spent.
   */
  async outputSpent(payload: OutputSpent): Promise<void> {
    if (payload.mode !== 'none') {
      throw new Error('Invalid payload mode')
    }

    const { topic, txid, outputIndex } = payload

    // Only process BTMS topic
    if (topic !== 'tm_btms') return

    await this.storage.deleteRecord(txid, outputIndex)
  }

  /**
   * Handle output eviction.
   */
  async outputEvicted(txid: string, outputIndex: number): Promise<void> {
    await this.storage.deleteRecord(txid, outputIndex)
  }

  /**
   * Lookup BTMS tokens.
   * 
   * Supported queries:
   * - { assetId: string } - Find all tokens for an asset
   * - { outpoint: "txid.outputIndex" } - Find a specific token
   * - { findAll: true } - Find all tokens (use sparingly)
   */
  async lookup(question: LookupQuestion): Promise<LookupFormula> {
    const query = question.query as Record<string, unknown> | undefined

    if (!query) {
      throw new Error('Lookup must include a valid query!')
    }

    // Query by assetId
    if (typeof query.assetId === 'string') {
      const results = await this.storage.findByAssetId(query.assetId)
      return results.map(r => ({ txid: r.txid, outputIndex: r.outputIndex }))
    }

    // Query by outpoint
    if (typeof query.outpoint === 'string') {
      const [txid, outputIndexStr] = query.outpoint.split('.')
      const outputIndex = Number(outputIndexStr)

      if (!txid || isNaN(outputIndex)) {
        throw new Error('Invalid outpoint format. Expected "txid.outputIndex"')
      }

      const result = await this.storage.findByOutpoint(txid, outputIndex)
      return result ? [{ txid: result.txid, outputIndex: result.outputIndex }] : []
    }

    // Find all (use sparingly)
    if (query.findAll === true) {
      const results = await this.storage.findAll()
      return results.map(r => ({ txid: r.txid, outputIndex: r.outputIndex }))
    }

    throw new Error('Query must include assetId, outpoint, or findAll!')
  }
}

/**
 * Factory function to create the BTMS Lookup Service.
 */
export default (db: Db) => new BTMSLookupService(db)
