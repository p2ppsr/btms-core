// src/btmsClient.ts

// 1) get the SAME btms instance the rest of the app uses
import { btms } from './btms'
import * as bsv from '@bsv/sdk'
import { createLocalOverlay } from './btms/localOverlay'

// 2) try to attach a local-overlay requester to that instance
try {
  const { requester } = createLocalOverlay()
  if (btms && typeof btms === 'object') {
    // TS thinks requester is private on BTMS, but we know we can patch it
    ;(btms as any).requester = requester
  }
} catch (err) {
  console.warn('[btmsClient] could not attach local overlay:', err)
}

// 3) expose *some* wallet so components that expect { wallet } don’t crash
let wallet: any = null
if (typeof window !== 'undefined') {
  const win = window as any
  const WalletClientCtor = (bsv as any).WalletClient

  if (WalletClientCtor) {
    if (win.walletClient instanceof WalletClientCtor) {
      wallet = win.walletClient
    } else {
      wallet = new WalletClientCtor('json-api', 'http://localhost:3321')
      win.walletClient = wallet
    }
  }

  // also expose the btms instance globally so other code finds the SAME one
  win.__btmsCoreInstance = btms
}

export { btms, wallet }
export default btms
