import { AdmittanceInstructions, TopicManager } from '@bsv/overlay'
import { Transaction, PushDrop } from '@bsv/sdk'
import docs from './BTMSTopicDocs.md.js'

/**
 * BTMS Topic Manager
 * 
 * Validates and admits BTMS PushDrop token outputs.
 * Only outputs that contain valid BTMS tokens are admitted.
 * 
 * BTMS Token Structure (4 fields):
 *   0: assetId (string)
 *   1: amount (string, numeric)
 *   2: op ("ISSUE" | "TRANSFER")
 *   3: metadata (JSON string)
 */
export default class BTMSTopicManager implements TopicManager {
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
      name: 'BTMS Topic Manager',
      shortDescription: 'Manages BTMS (Basic Token Management System) token outputs.'
    }
  }

  /**
   * Identify which outputs from the transaction should be admitted to this topic.
   * Only admits outputs that are valid BTMS PushDrop tokens.
   */
  async identifyAdmissibleOutputs(
    beef: number[],
    previousCoins: number[]
  ): Promise<AdmittanceInstructions> {
    const outputsToAdmit: number[] = []

    try {
      const tx = Transaction.fromBEEF(beef)

      // Check each output for valid BTMS token structure
      for (const [i, output] of tx.outputs.entries()) {
        try {
          // Attempt to decode as PushDrop
          const result = PushDrop.decode(output.lockingScript)

          // BTMS tokens must have at least 4 fields
          if (result.fields.length < 4) {
            continue
          }

          // Validate field structure
          const assetId = new TextDecoder().decode(new Uint8Array(result.fields[0]))
          const amountStr = new TextDecoder().decode(new Uint8Array(result.fields[1]))
          const op = new TextDecoder().decode(new Uint8Array(result.fields[2]))
          const metadata = new TextDecoder().decode(new Uint8Array(result.fields[3]))

          // Validate assetId is non-empty
          if (!assetId || assetId.trim().length === 0) {
            continue
          }

          // Validate amount is a positive number
          const amount = Number(amountStr)
          if (!Number.isFinite(amount) || amount <= 0) {
            continue
          }

          // Validate op is ISSUE or TRANSFER
          if (op !== 'ISSUE' && op !== 'TRANSFER') {
            continue
          }

          // Validate metadata is valid JSON
          try {
            JSON.parse(metadata)
          } catch {
            continue
          }

          // All validations passed - admit this output
          outputsToAdmit.push(i)
        } catch {
          // Not a valid PushDrop, skip this output
          continue
        }
      }

      if (outputsToAdmit.length === 0) {
        // No valid BTMS tokens found
        return {
          coinsToRetain: [],
          outputsToAdmit: []
        }
      }

      return {
        coinsToRetain: previousCoins,
        outputsToAdmit
      }
    } catch (error) {
      // Transaction parsing failed
      console.error('[BTMSTopicManager] Failed to parse transaction:', error)
      return {
        coinsToRetain: [],
        outputsToAdmit: []
      }
    }
  }
}
