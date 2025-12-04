// backend/src/routes/btmsHistory.ts
import { Router, Request, Response } from 'express'
import { Db } from 'mongodb'
import { BTMSStorage, BTMSRecord } from '../lookup-services/BTMSStorage'

/**
 * Shape we return to the frontend.
 * This is a stable, API-facing DTO that hides any Mongo-specific details.
 */
export interface BTMSHistoryItemDTO {
  txid: string
  outputIndex: number

  assetId?: string
  amount?: number
  metadata?: unknown

  createdAt?: string

  // raw debug fields, if present
  hasBeef?: boolean
  beefLength?: number
  hasLockingScript?: boolean
  lockingScriptLength?: number
}

/**
 * Server-side collector: gather BTMS overlay "history" for the caller.
 *
 * NOTE (2025-11-20):
 *   BTMSRecord currently does NOT store identityKey or event-type
 *   (send / receive / internalize / refund). So this function
 *   simply streams back EVERYTHING we have in BTMSRecords.
 *
 *   Once BTMSRecord includes identityKey + eventType, this is the
 *   ONLY function you should touch to add filtering/aggregation.
 */
export async function collectBtmsHistory(storage: BTMSStorage, identityKey?: string): Promise<BTMSHistoryItemDTO[]> {
  // For now, ignore identityKey; we don't have it on BTMSRecord yet.
  // The param is kept so we can start filtering as soon as the schema
  // is enriched.
  void identityKey

  const docs: BTMSRecord[] = await storage.findAll()

  return docs.map(d => ({
    txid: d.txid,
    outputIndex: d.outputIndex,

    assetId: d.assetId,
    amount: d.amount as number | undefined,
    metadata: d.metadata,

    createdAt:
      typeof d.createdAt === 'string'
        ? d.createdAt
        : d.createdAt instanceof Date
          ? d.createdAt.toISOString()
          : undefined,

    hasBeef: Array.isArray(d.beef),
    beefLength: Array.isArray(d.beef) ? d.beef.length : undefined,
    hasLockingScript: Array.isArray(d.lockingScript),
    lockingScriptLength: Array.isArray(d.lockingScript) ? d.lockingScript.length : undefined
  }))
}

/**
 * Factory that creates an Express.Router and wires:
 *
 *   GET /overlay/ls_btms/history?identityKey=<active>
 *
 * into the app.
 *
 * Integration:
 *   import createBtmsHistoryRouter from "./routes/btmsHistory";
 *   app.use(createBtmsHistoryRouter(db));
 */
export default function createBtmsHistoryRouter(db: Db): Router {
  const router = Router()
  const storage = new BTMSStorage(db)

  router.get('/overlay/ls_btms/history', async (req: Request, res: Response) => {
    const identityKeyParam = req.query.identityKey
    const identityKey =
      typeof identityKeyParam === 'string' && identityKeyParam.length > 0 ? identityKeyParam : undefined

    try {
      const items = await collectBtmsHistory(storage, identityKey)

      // Very lightweight log so we can see usage without spamming.
      console.log(
        '[BTMSHistory] GET /overlay/ls_btms/history',
        JSON.stringify(
          {
            identityKey: identityKey ?? null,
            count: items.length
          },
          null,
          2
        )
      )

      res.json({
        ok: true,
        identityKey: identityKey ?? null,
        count: items.length,
        items
      })
    } catch (err: any) {
      console.error('[BTMSHistory] error collecting history', err?.message || err)

      res.status(500).json({
        ok: false,
        error: err?.message || 'Failed to collect BTMS history'
      })
    }
  })

  return router
}
