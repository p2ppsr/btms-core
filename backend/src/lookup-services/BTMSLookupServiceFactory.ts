// backend/src/lookup-services/BTMSLookupServiceFactory.ts

import {
  LookupService,
  LookupQuestion,
  AdmissionMode,
  SpendNotificationMode,
  OutputAdmittedByTopic,
  OutputSpent,
  LookupServiceMetaData
} from '@bsv/overlay'
import { Db } from 'mongodb'
import { Utils } from '@bsv/sdk'
import { BTMSStorage } from './BTMSStorage'
import docs from './BTMSLookupDocs.md'
// @ts-ignore -- JS lib, no types
import pushdrop from 'pushdrop'

/**
 * BTMS lookup service:
 *  - Admit locking-script outputs and store minimal info.
 *  - Lookups MUST return a **PLAIN ARRAY** (engine maps over it).
 *    Here we return Meter-style rows:
 *      { txid, outputIndex, context?: number[] }
 *    where `context` holds AtomicBEEF bytes.
 */
class BTMSLookupService implements LookupService {
  readonly admissionMode: AdmissionMode = 'locking-script'
  readonly spendNotificationMode: SpendNotificationMode = 'none'

  constructor(public storage: BTMSStorage) {}

  async getDocumentation(): Promise<string> {
    return docs
  }

  async getMetaData(): Promise<LookupServiceMetaData> {
    return {
      name: 'BTMS Lookup Service',
      shortDescription:
        'Indexes BTMS/pushdrop UTXOs; supports findAll / by-asset / by-outpoint.'
    }
  }

  /**
   * Admit handler — only for locking-script mode.
   * Stores: { txid, outputIndex, assetId?, amount?, metadata?, beef?, lockingScript? }
   *
   * Core shape (txid, outputIndex, assetId, amount, metadata) stays the same
   * as your original 4 tokens. `beef` and `lockingScript` are additive.
   */
  async outputAdmittedByTopic(payload: OutputAdmittedByTopic): Promise<void> {
    if (payload.mode !== 'locking-script') return

    const { txid, outputIndex, lockingScript } = payload

    // Optional pushdrop decode for assetId/amount/metadata
    let assetId: string | undefined
    let amount: number | undefined
    let metadata: string | undefined

    // Optional extras for later (send/redemption)
    let lockingScriptBytes: number[] | undefined
    let beef: number[] | undefined

    try {
      // Normalise lockingScript to hex for pushdrop.decode
      const scriptHex =
        typeof (lockingScript as any)?.toHex === 'function'
          ? (lockingScript as any).toHex()
          : Array.isArray(lockingScript)
          ? Utils.toHex(lockingScript as number[])
          : String(lockingScript ?? '')

      // Preserve raw lockingScript bytes if overlay gave us an array
      if (Array.isArray(lockingScript)) {
        lockingScriptBytes = (lockingScript as number[]).map(n => Number(n))
      } else if ((lockingScript as any)?.toBuffer instanceof Function) {
        const buf = (lockingScript as any).toBuffer()
        lockingScriptBytes = Array.from(buf as Uint8Array)
      }

      const decoded = pushdrop.decode({ script: scriptHex, fieldFormat: 'utf8' })
      if (decoded?.fields) {
        assetId = decoded.fields[0] != null ? String(decoded.fields[0]) : undefined
        amount = decoded.fields[1] != null ? Number(decoded.fields[1]) : undefined
        metadata = decoded.fields[2] != null ? String(decoded.fields[2]) : undefined
      }
    } catch {
      // not pushdrop; ignore
    }

    // ---- Extract AtomicBEEF/context from the payload (if present) ----
    const anyPayload = payload as any
    const beefSource =
      anyPayload.context ??
      anyPayload.outputContext ??
      anyPayload.beef ??
      anyPayload.atomicBeef

    if (beefSource != null) {
      if (Array.isArray(beefSource)) {
        beef = beefSource.map((x: any) => Number(x))
      } else if (beefSource instanceof Uint8Array) {
        beef = Array.from(beefSource)
      }
      // (If the overlay uses some other binary type, we can extend this later.)
    }

    // Persist (BTMSStorage already supports these fields)
    await this.storage.saveOnAdmit({
      txid,
      outputIndex,
      assetId,
      amount,
      metadata,
      beef,
      lockingScript: lockingScriptBytes
    })
  }

  async outputSpent(_payload: OutputSpent): Promise<void> {
    // no-op for now
  }

  async outputEvicted(_txid: string, _outputIndex: number): Promise<void> {
    // no-op for now
  }

  /**
   * IMPORTANT: Return a **plain array** for ALL code paths.
   * We normalize to Meter-style:
   *   { txid, outputIndex, context?: number[] }
   *
   * Overlay engine will wrap this in the usual HTTP JSON:
   *   { type: "output-list", outputs: [...] }
   * so your existing curl /lookup examples keep working.
   */
  async lookup(
    question: LookupQuestion
  ): Promise<Array<{ txid: string; outputIndex: number; context?: number[] }>> {
    // Normalize query shape (accept {service,query:{...}} or flat)
    const src: any = question as any
    const q: any =
      src && typeof src.query === 'object' && src.query !== null ? src.query : src

    // 1) Exact outpoint (Meter-style): { txid, vout }
    if (typeof q?.txid === 'string' && Number.isFinite(q?.vout)) {
      const txid = q.txid
      const outputIndex = Number(q.vout)

      const doc = await this.storage.findByOutpoint(txid, outputIndex)
      if (!doc) return []
      return [this.storage.toMeterStyleOutput(doc as any)]
    }

    // 2) Named formula or boolean flag
    const formula: string | undefined =
      typeof q?.formula === 'string' ? q.formula : q?.findAll ? 'findAll' : undefined

    if (formula === 'findAll') {
      const docs = await this.storage.findAll()
      return docs.map(d => this.storage.toMeterStyleOutput(d as any))
    }

    if (formula === 'findByAssetId' || typeof q?.assetId === 'string') {
      const assetId: string = String(q.assetId ?? '')
      if (!assetId) return []
      const docs = await this.storage.findByAssetId(assetId)
      return docs.map(d => this.storage.toMeterStyleOutput(d as any))
    }

    // Default: empty array
    return []
  }
}

/** Factory */
export default (db: Db): BTMSLookupService => {
  return new BTMSLookupService(new BTMSStorage(db))
}
