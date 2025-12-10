/**
 * BTMS Backend Types
 */

/**
 * BTMS record stored in MongoDB.
 * Minimal storage: only txid, outputIndex, and indexed fields for lookup.
 */
export interface BTMSRecord {
  txid: string
  outputIndex: number
  assetId: string
  amount: number
}

/**
 * UTXO reference returned from lookup queries.
 */
export interface UTXOReference {
  txid: string
  outputIndex: number
}
