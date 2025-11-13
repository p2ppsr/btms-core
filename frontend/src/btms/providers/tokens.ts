// src/providers/tokens.ts

import type { OverlayProvider } from '../localOverlay'

type StoredToken = {
  txid: string
  vout: number
  outputScript: string
  rawTx: string
  satoshis: number
  inputs: any
  mapiResponses: any
  proof: any
}

export class TokensProvider implements OverlayProvider {
  name = 'tokens'

  // key: `${txid}:${vout}`
  private store = new Map<string, StoredToken>()

  async lookup(query: { txid?: string; vout?: number }): Promise<any[]> {
    // BTMS usually looks up by exact txid + vout
    if (query.txid && typeof query.vout === 'number') {
      const key = `${query.txid}:${query.vout}`
      const item = this.store.get(key)
      return item ? [item] : []
    }

    // if no query, return everything (debug)
    return Array.from(this.store.values())
  }

  async submit(body: any): Promise<{ status: string; topics?: Record<string, number[]> }> {
    const rawTx: string = body.rawTx
    const txid: string | undefined = body.txid
    const outputs: any[] = body.outputs || []
    const satoshis: number = outputs[0]?.satoshis ?? 0
    const outputScript: string = outputs[0]?.script ?? ''
    const vout = 0

    if (!txid) {
      // still return success so BTMS doesn't explode
      return {
        status: 'success',
        topics: {}
      }
    }

    const key = `${txid}:${vout}`
    this.store.set(key, {
      txid,
      vout,
      outputScript,
      rawTx,
      satoshis,
      inputs: body.inputs ?? null,
      mapiResponses: body.mapiResponses ?? null,
      proof: body.proof ?? null
    })

    let topics: Record<string, number[]> = {}
    if (Array.isArray(body.topics)) {
      topics = body.topics.reduce((acc: Record<string, number[]>, t: string, i: number) => {
        acc[t] = [i]
        return acc
      }, {} as Record<string, number[]>)
    }

    return {
      status: 'success',
      topics
    }
  }
}
