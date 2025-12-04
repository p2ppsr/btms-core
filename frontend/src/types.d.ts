// frontend/src/types.d.ts

import { WalletProtocol } from '@bsv/sdk'

declare module 'btms-core' {
  // --- from backend/src/btms/index.ts ---------------------------------

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

  // minimal shape used by incoming payments
  export interface TokenForRecipient {
    txid: TXIDHexString
    vout: number
    amount: SatoshisValue
    keyID: KeyIDStringUnder800Bytes
    lockingScript: HexString
    /**
     * Some call-sites read token.assetId. Make it optional
     * so those sites can compile without changing runtime code.
     */
    assetId?: string
    /**
     * Optional pre-hydrated beef fields when available.
     */
    beef?: number[] | Uint8Array
    beefPayload?: number[] | Uint8Array
  }

  export interface IncomingPayment {
    txid: TXIDHexString
    vout: number
    lockingScript: HexString
    amount: SatoshisValue
    token: TokenForRecipient
    sender: string
    messageId: string
    keyID: KeyIDStringUnder800Bytes
  }

  export interface SubmitResult {
    status: 'success'
    topics: Record<string, number[]>
  }

  // --- send helpers ----------------------------------------------------

  export interface SendTokenRef {
    txid: TXIDHexString
    vout: number
    beef?: number[] | Uint8Array
    beefPayload?: number[] | Uint8Array
    keyID?: KeyIDStringUnder800Bytes
    lockingScript?: HexString
    assetId?: string
  }

  export interface SendArgs {
    assetId: string
    recipient: string
    amount: SatoshisValue
    // Either flat outpoint…
    txid?: TXIDHexString
    vout?: number
    // …or a token object carrying the outpoint (and optional beef fields)
    token?: SendTokenRef
    // Optional message box override and metadata passthroughs
    messageBox?: string
    keyID?: KeyIDStringUnder800Bytes
    lockingScript?: HexString
    beef?: number[] | Uint8Array
    beefPayload?: number[] | Uint8Array
  }

  // --- BTMS class (skinny, but with methods your UI uses) --------------

  export class BTMS {
    constructor(
      tokensMessageBox?: string,
      protocolID?: WalletProtocol,
      basket?: BasketStringUnder300Bytes,
      tokensTopic?: string,
      satoshis?: SatoshiValue,
      privateKey?: string,
      marketplaceMessageBox?: string,
      marketplaceTopic?: string
    )

    // dashboard
    listAssets(): Promise<Asset[]>

    // mint page
    issue(amount: SatoshisValue, name: string): Promise<SubmitResult>

    // send page (legacy positional)
    send(assetId: string, recipient: string, sendamount: SatoshisValue): Promise<SubmitResult>

    // send page (new-world object form with outpoint / beef)
    send(args: SendArgs): Promise<SubmitResult>

    // receive page
    listIncomingPayments(assetId: string): Promise<IncomingPayment[]>
    acceptIncomingPayment(assetId: string, payment: IncomingPayment): Promise<boolean>
    refundIncomingTransaction(assetId: string, payment: IncomingPayment): Promise<SubmitResult>

    // tokens page
    getTransactions(
      assetId: string,
      limit: number,
      offset: number
    ): Promise<{
      transactions: Array<{
        date: string
        amount: SatoshisValue
        txid: TXIDHexString
        counterparty: WalletCounterparty
      }>
    }>
  }

  // --- app-injected helpers -------------------------------------------

  // what you're calling from App.tsx
  export function setBTMSWallet(wallet: any): void

  // optional, exported in backend too
  export function setBTMSAuthFetch(fn: (url: string, init?: RequestInit) => Promise<Response>): void
}
