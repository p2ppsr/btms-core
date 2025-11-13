// frontend/src/types.d.ts

declare module 'btms-core' {
  // --- from backend/src/btms/index.ts ---------------------------------

  export interface Asset {
    assetId: string
    balance: number
    name?: string
    iconURL?: string
    metadata?: string
    incoming?: boolean
    incomingAmount?: number
    new?: boolean
  }

  // minimal shape used by incoming payments
  export interface TokenForRecipient {
    txid: string
    vout: number
    amount: number
    keyID: string
    outputScript: string
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
    txid: string
    vout: number
    outputScript: string
    amount: number
    token: TokenForRecipient
    sender: string
    messageId: string
    keyID: string
  }

  export interface SubmitResult {
    status: 'success'
    topics: Record<string, number[]>
  }

  // --- send helpers ----------------------------------------------------

  export interface SendTokenRef {
    txid: string
    vout: number
    beef?: number[] | Uint8Array
    beefPayload?: number[] | Uint8Array
    keyID?: string
    outputScript?: string
    assetId?: string
  }

  export interface SendArgs {
    assetId: string
    recipient: string
    amount: number
    // Either flat outpoint…
    txid?: string
    vout?: number
    // …or a token object carrying the outpoint (and optional beef fields)
    token?: SendTokenRef
    // Optional message box override and metadata passthroughs
    messageBox?: string
    keyID?: string
    outputScript?: string
    beef?: number[] | Uint8Array
    beefPayload?: number[] | Uint8Array
  }

  // --- BTMS class (skinny, but with methods your UI uses) --------------

  export class BTMS {
    constructor(
      tokensMessageBox?: string,
      protocolID?: string,
      basket?: string,
      tokensTopic?: string,
      satoshis?: number,
      privateKey?: string,
      marketplaceMessageBox?: string,
      marketplaceTopic?: string
    )

    // dashboard
    listAssets(): Promise<Asset[]>

    // mint page
    issue(amount: number, name: string): Promise<SubmitResult>

    // send page (legacy positional)
    send(
      assetId: string,
      recipient: string,
      sendAmount: number
    ): Promise<SubmitResult>

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
        amount: number
        txid: string
        counterparty: string
      }>
    }>
  }

  // --- app-injected helpers -------------------------------------------

  // what you're calling from App.tsx
  export function setBTMSWallet(wallet: any): void

  // optional, exported in backend too
  export function setBTMSAuthFetch(
    fn: (url: string, init?: RequestInit) => Promise<Response>
  ): void
}
