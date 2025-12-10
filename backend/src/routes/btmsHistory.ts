// backend/src/routes/btmsHistory.ts
import { Router, Request, Response } from 'express'
import { Db } from 'mongodb'
import { BTMSStorage } from '../lookup-services/BTMSStorage.js'
import { UTXOReference } from '../types.js'

/**
 * Shape we return to the frontend.
 */
export interface BTMSHistoryItemDTO {
  txid: string
  outputIndex: number
}

/**
 * Server-side collector: gather BTMS overlay "history" for the caller.
 * Returns all BTMS UTXOs currently indexed.
 */
export async function collectBtmsHistory(storage: BTMSStorage, _identityKey?: string): Promise<BTMSHistoryItemDTO[]> {
  const docs: UTXOReference[] = await storage.findAll()
  return docs.map(d => ({
    txid: d.txid,
    outputIndex: d.outputIndex
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
