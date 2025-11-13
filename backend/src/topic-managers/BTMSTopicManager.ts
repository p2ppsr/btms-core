import { AdmittanceInstructions, TopicManager } from '@bsv/overlay'
import { Transaction } from '@bsv/sdk'
import docs from './BTMSTopicDocs.md'

// JS lib, no types — same as in your btms-core
// if the overlay runtime already has this available, use that path
// @ts-ignore
import pushdrop from 'pushdrop'

/**
 * Admits outputs that look like BTMS / pushdrop token outputs.
 * Very similar in shape to BTMSTopicManager, but instead of parsing an sCrypt
 * contract, we just try pushdrop.decode(...) on each output script.
 */
export default class BTMSTopicManager implements TopicManager {
  /**
   * Decide which outputs from the submitted tx should be admitted to this topic.
   */
  async identifyAdmissibleOutputs(
    beef: number[],
    previousCoins: number[]
  ): Promise<AdmittanceInstructions> {
    const outputsToAdmit: number[] = []

    try {
      const tx = Transaction.fromBEEF(beef)

      for (const [i, output] of tx.outputs.entries()) {
        try {
          // Try to decode as pushdrop
          const decoded = pushdrop.decode({
            script: output.lockingScript.toHex(),
            fieldFormat: 'utf8'
          })

          // Minimal sanity: need at least assetId + amount
          if (
            Array.isArray(decoded.fields) &&
            decoded.fields.length >= 2 &&
            typeof decoded.fields[0] === 'string' &&
            typeof decoded.fields[1] === 'string'
          ) {
            // If you want to enforce “belongs to btms” via protocolID in pushdrop,
            // you could check decoded.protocolID / decoded.keyID / decoded.counterparty here.
            outputsToAdmit.push(i)
          }
        } catch (_) {
          // not a BTMS/pushdrop output — ignore
          continue
        }
      }

      if (outputsToAdmit.length === 0) {
        // like BTMSTopicManager, we can be permissive and not throw
        console.warn('BTMSTopicManager: no outputs admitted for this tx')
      }
    } catch (error) {
      const beefStr = JSON.stringify(beef, null, 2)
      throw new Error(
        `BTMSTopicManager: error identifying admissible outputs: ${error} beef:${beefStr}}`
      )
    }

    return {
      outputsToAdmit,
      coinsToRetain: previousCoins
    }
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
      name: 'BTMS Topic Manager',
      shortDescription: 'Admits BTMS / pushdrop token outputs.'
    }
  }
}
