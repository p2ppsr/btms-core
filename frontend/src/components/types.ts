import { SatoshiValue } from '@bsv/sdk'

// src/types.ts
export interface Asset {
  assetId: string
  balance: SatoshiValue
  name?: string
  iconURL?: string
  metadata?: string
  incoming?: boolean
  incomingAmount?: SatoshiValue
  new?: boolean
}
