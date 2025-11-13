// src/providers/marketplace.ts

import type { OverlayProvider } from '../localOverlay'

type StoredListing = {
  txid: string
  vout: number
  outputScript: string
  rawTx: string
  satoshis: number
  seller?: string
}

export class MarketplaceProvider implements OverlayProvider {
  name = 'marketplace'

  private store = new Map<string, StoredListing>()

  async lookup(query: {
    txid?: string
    vout?: number
    findAll?: boolean
    assetId?: string
    seller?: string
  }): Promise<any[]> {
    // lookup by exact outpoint
    if (query.txid && typeof query.vout === 'number') {
      const key = `${query.txid}:${query.vout}`
      const item = this.store.get(key)
      return item ? [item] : []
    }

    // list all
    const all = Array.from(this.store.values())

    if (query.findAll) {
      return all
    }

    if (query.seller) {
      return all.filter(x => x.seller === query.seller)
    }

    return all
  }

  async submit(body: any): Promise<{ status: string; topics?: Record<string, number[]> }> {
    const rawTx: string = body.rawTx
    const txid: string | undefined = body.txid
    const outputs: any[] = body.outputs || []
    const satoshis: number = outputs[0]?.satoshis ?? 0
    const outputScript: string = outputs[0]?.script ?? ''
    const vout = 0

    if (!txid) {
      return {
        status: 'success',
        topics: {}
      }
    }

    const key = `${txid}:${vout}`

    this.store.set(key, {
      txid,
      vout,
      rawTx,
      outputScript,
      satoshis
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
