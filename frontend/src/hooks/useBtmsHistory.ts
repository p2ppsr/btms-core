// frontend/src/hooks/useBtmsHistory.ts
import { useCallback, useEffect, useState } from 'react'

/**
 * Keep in sync with backend/src/routes/btmsHistory.ts BTMSHistoryItemDTO
 */
export interface BTMSHistoryItem {
  txid: string
  outputIndex: number

  assetId?: string
  amount?: number
  metadata?: unknown

  createdAt?: string

  hasBeef?: boolean
  beefLength?: number
  hasLockingScript?: boolean
  lockingScriptLength?: number
}

export interface UseBtmsHistoryResult {
  history: BTMSHistoryItem[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

/**
 * useBtmsHistory(identityKey)
 *
 * Calls:
 *   GET /overlay/ls_btms/history?identityKey=<active>
 *
 * and returns the history list + loading/error state.
 *
 * IMPORTANT:
 *   For now, the backend does not *filter* by identityKey, because
 *   identityKey is not yet stored on BTMSRecord. We still accept
 *   the param so wiring is ready for when we add that.
 */
export function useBtmsHistory(identityKey: string | null | undefined): UseBtmsHistoryResult {
  const [history, setHistory] = useState<BTMSHistoryItem[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = identityKey && identityKey.length > 0 ? `?identityKey=${encodeURIComponent(identityKey)}` : ''

      const res = await fetch(`/overlay/ls_btms/history${params}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status} ${res.statusText}${text ? `: ${text.slice(0, 200)}` : ''}`)
      }

      const body = (await res.json()) as {
        ok?: boolean
        items?: BTMSHistoryItem[]
        error?: string
      }

      if (body.ok === false) {
        throw new Error(body.error || 'History API returned ok=false')
      }

      const items = Array.isArray(body.items) ? body.items : []
      setHistory(items)
    } catch (err: any) {
      const msg = err?.message || 'Failed to load BTMS history'
      console.error('[useBtmsHistory] error', msg)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [identityKey])

  useEffect(() => {
    void fetchHistory()
  }, [fetchHistory])

  return {
    history,
    loading,
    error,
    reload: fetchHistory
  }
}

export default useBtmsHistory
