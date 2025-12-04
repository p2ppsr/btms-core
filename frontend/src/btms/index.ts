import {
  LockingScript,
  P2PKH,
  PublicKey,
  Utils,
  PushDrop,
  WalletClient,
  AtomicBEEF,
  InternalizeOutput,
  Beef,
  TXIDHexString,
  LabelStringUnder300Bytes,
  HexString,
  OutputTagStringUnder300Bytes,
  Transaction,
  OutpointString,
  DescriptionString5to50Bytes,
  BasketStringUnder300Bytes,
  SatoshiValue,
  Base64String,
  WalletProtocol,
  KeyIDStringUnder800Bytes,
  WalletCounterparty,
  OriginatorDomainNameStringUnder250Bytes,
  WERR_REVIEW_ACTIONS,
  TopicBroadcaster,
  BroadcastResponse,
  BroadcastFailure,
  CreateActionResult,
  CreateActionArgs,
  WalletOutput,
  CreateActionInput,
  CreateActionOutput,
  ListOutputsArgs,
  ListOutputsResult,
  ListActionsArgs,
  ListActionsResult,
  WalletInterface,
  SignActionArgs,
  InternalizeActionArgs,
  PositiveIntegerOrZero,
  LookupResolver
} from '@bsv/sdk'
// use the shared logger (so logging.config.ts can turn this on/off)
import { logWithTimestamp } from '../utils/logging'
import { MessageBoxClient } from '@bsv/message-box-client'

/**
 * Simple wrapper so all BTMS debug lines have a consistent prefix.
 */
/**
 * Global debug switch.
 */
const BTMS_DEBUG = false

const BTMS_SOURCE_TAG = 'frontend/src/btms/index.ts'

// For testing
// Name of the permission scheme / protocol (BRC-98/99)
const PERMISSION_PROTOCOL = getNormalisedLabel('btmsToken')
const ASSET_ID_TERM = getNormalisedLabel('assetId')

const PROTOCOL = PERMISSION_PROTOCOL
const PROTOCOL_KEY_ID = '1'

const PROTOCOL_ID: WalletProtocol = [0, PROTOCOL]

// Basket prefix = protocol / permission scheme name
const BASKET_PREFIX = PROTOCOL

// Initial basket when BTMS starts
const INIT_BASKET = PROTOCOL

// Version prefix for asset namespace (e.g., v1, v2, v3)
const ASSET_ID_VERSION_PREFIX = 'v'
const ASSET_ID_VERSION = `${ASSET_ID_VERSION_PREFIX}1` // "v1"

// btmstoken v1
const TOKEN_BASKET_PREFIX = `${PROTOCOL} ${ASSET_ID_VERSION}`

// btmstoken v1 assetid=
const ASSET_PROTOCOL = `${TOKEN_BASKET_PREFIX} ${ASSET_ID_TERM}=`

function btmsDebug(label: string, ...rest: any[]) {
  if (!BTMS_DEBUG) return
  logWithTimestamp(`[BTMS:${BTMS_SOURCE_TAG}] ${label}`, ...rest)
}

/**
 * per-call id so we can correlate
 */
function makeDebugCallId(prefix = 'call'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

const walletClient = new WalletClient()

/* ------------------------------------------------------------------ */
/* script extraction from a wallet-output object */
/* ------------------------------------------------------------------ */
function extractLockingScriptFromWalletOutput(o: any): string {
  if (!o || typeof o !== 'object') return ''
  if (typeof o.lockingScript === 'string' && o.lockingScript) return o.lockingScript
  if (typeof o.script === 'string' && o.script) return o.script
  const envOut = o.beefPayload?.outputs?.[0]
  if (envOut) {
    if (typeof envOut.lockingScript === 'string' && envOut.lockingScript) {
      return envOut.lockingScript
    }
    if (typeof envOut.script === 'string' && envOut.script) {
      return envOut.script
    }
  }
  const outs0 = o.outputs?.[0]
  if (outs0) {
    if (typeof outs0.lockingScript === 'string' && outs0.lockingScript) {
      return outs0.lockingScript
    }
    if (typeof outs0.script === 'string' && outs0.script) {
      return outs0.script
    }
  }
  const outObj = o.output
  if (outObj) {
    if (typeof outObj.lockingScript === 'string' && outObj.lockingScript) {
      return outObj.lockingScript
    }
    if (typeof outObj.script === 'string' && outObj.script) {
      return outObj.script
    }
  }
  return ''
}

/* ------------------------------------------------------------------ */
/* small helpers */
/* ------------------------------------------------------------------ */

/**
 * Verify that the possibly undefined value currently has a value.
 */
function verifyTruthy<T>(v: T | null | undefined, description?: string): T {
  if (v == null) throw new Error(description ?? 'A truthy value is required.')
  return v
}

function shortHex(hex?: string | null, len = 16): string {
  if (!hex || typeof hex !== 'string') return String(hex)
  const h = hex.toLowerCase()
  return h.length <= len ? h : `${h.slice(0, len)}…(${h.length})`
}

function makeId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Global, optional, app-provided authenticated fetch.
 */
let activeAuthFetch: ((url: string, init?: RequestInit) => Promise<Response>) | null = null

export function setBTMSAuthFetch(fn: (url: string, init?: RequestInit) => Promise<Response>) {
  activeAuthFetch = fn
}

const DEFAULT_MESSAGEBOX_HOST = 'https://messagebox.babbage.systems'

class MessageBoxTokenator {
  private walletClient: WalletInterface
  private defaultBox: string
  private host: string
  private client: MessageBoxClient | null = null
  private initPromise: Promise<MessageBoxClient> | null = null

  constructor(walletClient: WalletInterface, defaultBox: string, host = DEFAULT_MESSAGEBOX_HOST) {
    this.walletClient = walletClient
    this.defaultBox = defaultBox
    this.host = host
  }

  // --------------------------
  // Types used internally
  // --------------------------
  private static isUint8Array(x: unknown): x is Uint8Array {
    return x instanceof Uint8Array
  }

  private static isNumberArray(x: unknown): x is number[] {
    return Array.isArray(x) && x.every(n => typeof n === 'number')
  }

  private static safeParseJSON(str: string): unknown | null {
    try {
      return JSON.parse(str)
    } catch {
      return null
    }
  }

  // ---------------------------------------------------------
  // Ensure underlying MessageBoxClient is initialized
  // ---------------------------------------------------------
  private async ensureClient(): Promise<MessageBoxClient> {
    if (this.client) return this.client

    if (!this.initPromise) {
      if (BTMS_DEBUG) {
        btmsDebug('MessageBoxTokenator: creating MessageBoxClient…', {
          host: this.host,
          box: this.defaultBox
        })
      }

      const net = await this.walletClient.getNetwork({})
      const networkPreset = net?.network ?? 'mainnet'

      this.initPromise = (async () => {
        const client = new MessageBoxClient({
          host: this.host,

          walletClient: this.walletClient,

          enableLogging: true,
          networkPreset
        })

        await client.init()

        if (BTMS_DEBUG) {
          btmsDebug('MessageBoxTokenator: client.init() done')
        }

        this.client = client
        return client
      })()
    }

    return this.initPromise
  }

  // ---------------------------------------------------------
  // Explicit init that BTMS can await
  // ---------------------------------------------------------
  async init(): Promise<void> {
    if (BTMS_DEBUG) {
      btmsDebug('MessageBoxTokenator.init(): ensuring MessageBoxClient is ready', {
        defaultBox: this.defaultBox
      })
    }

    await this.ensureClient()
  }

  // -------------------------------------------------------
  // Strongly typed sendMessage
  // -------------------------------------------------------
  async sendMessage(args: { recipient: string; messageBox?: string; body: string }): Promise<void> {
    const client = await this.ensureClient()
    const { recipient, messageBox, body } = args
    const box = messageBox ?? this.defaultBox

    const payload: string = body
    const bodyObj = MessageBoxTokenator.safeParseJSON(body)

    let beefLen: number | null = null

    if (bodyObj && typeof bodyObj === 'object') {
      const maybeBeef = (bodyObj as { beef?: unknown }).beef ?? (bodyObj as { token?: { beef?: unknown } }).token?.beef

      if (MessageBoxTokenator.isNumberArray(maybeBeef)) beefLen = maybeBeef.length
      if (MessageBoxTokenator.isUint8Array(maybeBeef)) beefLen = maybeBeef.length
    }

    if (BTMS_DEBUG) {
      btmsDebug('MessageBoxTokenator.sendMessage ->', {
        recipient,
        box,
        bodyPreview: payload.slice(0, 160),
        beefLen
      })
    }

    const t0 = Date.now()

    try {
      const resp = await client.sendMessage({
        recipient,
        messageBox: box,
        body: payload
      })

      btmsDebug('[MessageBoxTokenator] sendMessage OK', {
        ms: Date.now() - t0,
        hasResp: !!resp,
        status: resp.status,
        id: resp.messageId,
        beefLen
      })
    } catch (e) {
      const err = e as Error
      btmsDebug('[MessageBoxTokenator] sendMessage ERROR', {
        ms: Date.now() - t0,
        message: err.message,
        stackTop: (err.stack ?? '').split('\n').slice(0, 3).join(' | ')
      })
      throw err
    }
  }

  // -------------------------------------------------------
  // listMessages
  // -------------------------------------------------------
  async listMessages(args: { messageBox?: string }) {
    const client = await this.ensureClient()
    const box = args.messageBox ?? this.defaultBox
    return client.listMessages({ messageBox: box })
  }

  // -------------------------------------------------------
  // acknowledge single
  // -------------------------------------------------------
  async acknowledgeMessage(args: { messageIds: string[] }): Promise<void> {
    return this.acknowledgeMessages(args)
  }

  // -------------------------------------------------------
  // acknowledge multiple
  // -------------------------------------------------------
  async acknowledgeMessages(args: { messageIds: string[] }): Promise<void> {
    const client = await this.ensureClient()
    if (!args.messageIds.length) return

    await client.acknowledgeMessage({ messageIds: args.messageIds })
  }
}

export interface Asset {
  assetId: string
  balance: number
  name?: string
  iconURL?: string
  metadata?: string
  incoming?: boolean
  incomingAmount?: number
  new?: boolean
  /**
   * TRUE when a MessageBox entry exists awaiting acceptance
   * for this specific assetId.
   *
   * This is used solely for showing/hiding the Receive button.
   */
  hasPendingIncoming: boolean
}

// Minimal “old-world output” shape so OwnershipProof compiles
export interface GetTransactionOutputResult {
  txid: TXIDHexString
  vout: number
  lockingScript: HexString
  satoshis: SatoshiValue
  basket?: BasketStringUnder300Bytes
}

// Minimal linkage shape we actually care about
export interface SpecificKeyLinkageResult {
  assetId: string
  amount: number
}

// NEW-WORLD Token object delivered to recipients
export interface TokenForRecipient {
  txid: TXIDHexString
  vout: number

  /**
   * Logical token quantity (e.g. 4 CAT), not satoshis.
   */
  amount: number

  /**
   * Underlying satoshi value in the UTXO.
   */
  satoshis: SatoshiValue

  /**
   * Canonical BEEF form (AtomicBEEF = Uint8Array).
   * We normalise any incoming BEEF to this at the edges.
   */
  beef: AtomicBEEF

  /**
   * NEW — receiver prefers this plain number[] form.
   * Used by listIncomingPayments() via beefPayload ?? beef.
   */
  beefPayload?: number[]

  /**
   * Branded key ID from WalletInterface.
   */
  keyID: KeyIDStringUnder800Bytes

  /**
   * Always a HEX string inside BTMS.
   */
  lockingScript: HexString
}

export interface SubmitResult {
  status: 'success'
  topics: Record<string, number[]>
}

export interface OverlaySearchResult {
  inputs: string | null
  mapiResponses: string | null
  lockingScript: HexString
  proof: string | null
  rawTx: string
  satoshis: SatoshiValue
  txid: TXIDHexString
  vout: number
}

export interface IncomingPayment {
  tx: AtomicBEEF
  txid: TXIDHexString
  vout: number
  lockingScript: HexString
  amount: number
  satoshis: SatoshiValue
  sender: WalletCounterparty
  messageId?: string
  keyID: KeyIDStringUnder800Bytes
  assetId: string
  // NEW — used for UI + internal fixes
  stillPending?: boolean
}

export interface OwnershipProof {
  prover: WalletCounterparty
  verifier: WalletCounterparty
  assetId: string
  amount: number
  tokens: {
    output: GetTransactionOutputResult
    linkage: SpecificKeyLinkageResult
  }[]
}

export interface MarketplaceEntry {
  assetId: string
  amount: number
  seller: WalletCounterparty
  description: DescriptionString5to50Bytes
  desiredAssets: Record<string, number>
  ownershipProof: OwnershipProof
  metadata: string
}

// NEW-WORLD MINIMAL MarketplaceOffer (no EnvelopeApi)
export interface MarketplaceOffer {
  buyerOffersAssetId: string
  buyerOffersAmount: number
  buyerProof: OwnershipProof
  buyerPartialTX: string // keep as string for now; no BEEF needed yet
  sellerEntry: MarketplaceEntry
  fundingKeyID: KeyIDStringUnder800Bytes
  messageId?: string
  rejected?: boolean
  isAsDesiredBySeller?: boolean
}

interface BuyerOfferCustomInstructions {
  buyerProof: OwnershipProof
  buyerOfferedAssetId: string
  buyerOfferedAmount: number
  sellerEntry: MarketplaceEntry
  fundingKeyID: KeyIDStringUnder800Bytes
}

export interface BTMSWalletOutput extends WalletOutput {
  tx?: number // actually AtomicBEEF binary as number[]
  outputIndex?: number // new-world equivalent of vout
  vout?: number // fallback for older outputs
  customInstructions?: string // JSON string from createAction
}

/**
 * BTMSToken
 *
 * This class is the canonical place for building and unlocking
 * BTMS PushDrop token scripts.
 *
 * STRICT FIELD ORDER:
 *   0: assetId
 *   1: amount
 *   2: op               ("ISSUE" | "TRANSFER")
 *   3: metadata JSON
 *   4: signature        (always present; "" allowed)
 */
export class BTMSToken {
  private walletClient: WalletInterface

  constructor(walletClient: WalletClient = new WalletClient()) {
    this.walletClient = walletClient
  }

  async lock(
    protocolID: WalletProtocol,
    keyID: string,
    counterparty: WalletCounterparty,
    assetId: string,
    amount: number,
    metadata: string,
    op: 'ISSUE' | 'TRANSFER' = 'ISSUE',
    signature = '',
    forSelf = true
  ): Promise<LockingScript> {
    const callId = makeDebugCallId('BTMSToken.lock')
    btmsDebug(`${callId}: START`, {
      assetId,
      amount,
      op,
      forSelf,
      metadataLength: metadata.length,
      signaturePresent: signature.length > 0
    })

    // -----------------------------------------------------
    // 1. STRICT 5-FIELD SCHEMA
    // -----------------------------------------------------
    const fields: number[][] = [
      Utils.toArray(assetId, 'utf8'),
      Utils.toArray(String(amount), 'utf8'),
      Utils.toArray(op, 'utf8'),
      Utils.toArray(metadata, 'utf8'),
      Utils.toArray(signature, 'utf8') // strict 5th field
    ]

    btmsDebug(`${callId}: fields (string form)`, {
      field0: assetId,
      field1: String(amount),
      field2: op,
      field3: metadata,
      field4SignatureLength: signature.length
    })

    // -----------------------------------------------------
    // 2. Build PushDrop locking script
    // -----------------------------------------------------
    const pushdrop = new PushDrop(this.walletClient)

    const lockScript = await pushdrop.lock(fields, protocolID, keyID, counterparty, forSelf)

    const lockingScriptHex = lockScript.toHex()
    btmsDebug(`${callId}: lockingScript hex`, {
      lockingScriptHexPreview: lockingScriptHex.slice(0, 80) + '...'
    })

    btmsDebug(`${callId}: END — returning lockingScript`)
    return lockScript
  }

  unlock(protocolID: WalletProtocol, keyID: string, counterparty: WalletCounterparty) {
    return new PushDrop(this.walletClient).unlock(protocolID, keyID, counterparty)
  }
}

/**
 * BTMSFundingToken
 *
 * A minimal new-world funding output:
 * - Lock = simple P2PKH
 * - Unlock = use PushDrop.unlock() with wallet keys
 *
 * This mirrors the hello-tokens pattern exactly.
 */
export class BTMSFundingToken {
  private walletClient: WalletInterface

  constructor(walletClient: WalletInterface = new WalletClient()) {
    this.walletClient = walletClient
  }

  /**
   * Create a P2PKH locking script for a fee-funding UTXO.
   * Always returns HEX.
   */
  async lock(protocolID: WalletProtocol, keyID: string, counterparty: WalletCounterparty): Promise<LockingScript> {
    const { publicKey } = await this.walletClient.getPublicKey({
      protocolID,
      keyID,
      counterparty
    })

    const addr = PublicKey.fromString(publicKey).toAddress()

    // Standard blockchain funding output
    return new P2PKH().lock(addr)
  }

  /**
   * Unlocker for the funding UTXO.
   * Uses PushDrop.unlock(), same as hello-tokens.
   */
  unlock(protocolID: WalletProtocol, keyID: string, counterparty: WalletCounterparty) {
    // PushDrop.unlock works for ANY single-sig BSV script
    return new PushDrop(this.walletClient).unlock(protocolID, keyID, counterparty)
  }
}

export class BTMS {
  walletClient: WalletClient
  satoshis: SatoshiValue
  privateKey: string | undefined
  marketplaceTopic: string

  // --------------------------------------------------
  // NEW-WORLD BTMS v2 state
  // --------------------------------------------------
  private requester: (url: string, init?: RequestInit) => Promise<Response>
  basketPrefix: BasketStringUnder300Bytes = BASKET_PREFIX
  private currentIdentityKey: string | null = null

  // ---- Incoming Payment Cache Controls ----

  private _lastIncomingRun = 0
  private _lastIncomingResult: IncomingPayment[] | null = null

  private _incomingInFlight: Promise<void> | null = null

  // ---- Wallet Overload Detection State ----
  private basketLastCount: Record<string, number> = {}
  private basketOverload: Record<string, number> = {}
  private setAssetsCallback?: (assets: Asset[]) => void

  tokenator: MessageBoxTokenator

  tokensMessageBox: string
  marketplaceMessageBox: string

  protocolID: WalletProtocol
  protocolKeyID: KeyIDStringUnder800Bytes
  basket: BasketStringUnder300Bytes
  tokenTopic: string

  private instanceId: string
  currentIdentity?: string

  // ------------------------------------------------------------
  // StrictMode suppression fields (React 18 dev only)
  // ------------------------------------------------------------

  // ---- Wallet Overload Detection State ----
  private basketOverloadHits: Record<string, number> = {}

  async initAfterConstructor(): Promise<void> {
    const callId = makeDebugCallId('BTMS-startup')
    btmsDebug(`${callId}: waiting for wallet...`)
    await this.waitForWalletReady(callId)
    btmsDebug(`${callId}: wallet ready`)
  }

  private async waitForWalletReady(callId: string): Promise<void> {
    await this.waitForTransportReady(callId)
    await this.waitForIdentityStable(callId)
  }

  private async waitForIdentityStable(callId: string): Promise<void> {
    const MAX_RETRIES = 40
    const RETRY_MS = 150

    let lastKey: string | null = null
    let stableCount = 0

    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        const { publicKey } = await this.walletClient.getPublicKey({
          identityKey: true
        })

        if (typeof publicKey === 'string' && publicKey.length > 10) {
          if (lastKey === publicKey) {
            stableCount++
            if (stableCount >= 3) {
              btmsDebug(`${callId}: identity STABLE`, { publicKey })
              return
            }
          } else {
            lastKey = publicKey
            stableCount = 1
          }
        }
      } catch (err) {
        // permitted: wallet still switching
        stableCount = 0
        lastKey = null
      }

      await new Promise(r => setTimeout(r, RETRY_MS))
    }

    throw new Error(`${callId}: identity never stabilised`)
  }

  private async waitForTransportReady(callId: string): Promise<void> {
    for (let i = 0; i < 20; i++) {
      try {
        const v = await this.walletClient.getVersion()
        if (v && v.version) return
      } catch { }
      await new Promise(r => setTimeout(r, 150))
    }
    throw new Error(`${callId}: wallet transport not ready`)
  }

  private getRandomKeyID(): string {
    return '1'
    // Browser-safe, cryptographically strong
    // return crypto.randomUUID().replace(/-/g, "");
  }

  private decodeBTMSToken(scriptHex: string) {
    const callId = makeDebugCallId('decodeBTMSToken')

    try {
      const decoded = PushDrop.decode(LockingScript.fromHex(scriptHex))

      // PushDrop.decode returns number[][]
      const rawFields: number[][] = decoded.fields

      btmsDebug(`${callId}: RAW FIELD INFO`, {
        fieldCount: rawFields.length,
        fieldLengths: rawFields.map(arr => arr.length)
      })

      // Convert number[] → UTF-8 string
      const fields: string[] = rawFields.map(arr => Utils.toUTF8(arr))

      btmsDebug(`${callId}: UTF8 FIELDS`, { fields })

      // BTMS v2 requires app-level:
      //   [assetId, amount, op, metadataJson, signature]
      // Metanet client then appends its own signature as a 6th field.
      if (fields.length !== 5 && fields.length !== 6) {
        btmsDebug(`${callId}: INVALID — unexpected fieldCount`, {
          fieldCount: fields.length
        })
        return { valid: false as const }
      }

      const [assetId, amountStr, op, metadataJson, signatureField, walletSigField] = fields

      if (walletSigField !== undefined) {
        btmsDebug(`${callId}: WALLET SIGNATURE FIELD DETECTED`, {
          walletSigPreview: walletSigField.slice(0, 32)
        })
      }

      const amount = Number(amountStr)
      if (!Number.isFinite(amount) || amount <= 0) {
        btmsDebug(`${callId}: INVALID — bad amount`, { amountStr, amount })
        return { valid: false as const }
      }

      if (op !== 'ISSUE' && op !== 'TRANSFER') {
        btmsDebug(`${callId}: INVALID — unsupported op`, { op })
        return { valid: false as const }
      }

      const metadata = metadataJson && metadataJson.startsWith('{') ? metadataJson : '{}'

      const signature = signatureField ?? ''

      const result = {
        valid: true as const,
        assetId,
        amount,
        op,
        metadata,
        signature
      }

      btmsDebug(`${callId}: OK`, result)
      return result
    } catch (error) {
      btmsDebug(`${callId}: THROW`, { error })
      return { valid: false as const }
    }
  }

  setActiveAsset(assetId: string) {
    const basket: BasketStringUnder300Bytes = `${this.basketPrefix} ${assetId}`
    this.basket = basket
    btmsDebug(`BTMS active basket switched`, { basket, assetId })
  }

  constructor(
    walletClient: WalletClient,
    tokensMessageBox = 'tokens-box',
    protocolID: WalletProtocol = PROTOCOL_ID,
    protocolKeyID: KeyIDStringUnder800Bytes = PROTOCOL_KEY_ID,
    basket: BasketStringUnder300Bytes = INIT_BASKET,
    tokensTopic = 'tokens',
    satoshis: SatoshiValue = 1 as SatoshiValue,
    privateKey?: string,
    marketplaceMessageBox = 'marketplace',
    marketplaceTopic = 'marketplace'
  ) {
    this.walletClient = walletClient
    this.tokensMessageBox = tokensMessageBox
    this.protocolID = protocolID
    this.protocolKeyID = protocolKeyID
    this.basket = basket
    this.tokenTopic = tokensTopic
    this.satoshis = satoshis
    this.privateKey = privateKey

    // ------------------------------------------------------------
    // FIX: Correct v2 MessageBoxTokenator construction
    // ------------------------------------------------------------
    this.tokenator = new MessageBoxTokenator(this.walletClient, this.tokensMessageBox)

    this.marketplaceMessageBox = marketplaceMessageBox
    this.marketplaceTopic = marketplaceTopic

    // new-world authFetch requester
    this.requester = activeAuthFetch ? (url, init) => activeAuthFetch!(url, init) : (url, init) => fetch(url, init)

    this.instanceId = makeId('btmsInstance')

    btmsDebug('constructor called', {
      protocolID: this.protocolID,
      instanceId: this.instanceId,
      source: BTMS_SOURCE_TAG,
      stack: new Error('BTMS constructor stack').stack
    })
  }

  public onAssetsChanged(cb: (assets: Asset[]) => void) {
    this.setAssetsCallback = cb
  }

  /**
   * Always return HEX string for locking scripts.
   * Accepts: hex string, number[], Uint8Array
   */
  private toLockingScriptHex(value: unknown, callId: string, context: string): HexString | null {
    try {
      if (typeof value === 'string') {
        return value as HexString
      }

      if (Array.isArray(value)) {
        return Utils.toHex(value as number[]) as HexString
      }

      if (value instanceof Uint8Array) {
        return Utils.toHex(Array.from(value)) as HexString
      }

      btmsDebug(`${callId}: unsupported lockingScript type in ${context}`, {
        type: typeof value,
        value
      })
      return null
    } catch (e) {
      btmsDebug(`${callId}: toLockingScriptHex FAILED in ${context}`, {
        error: e
      })
      return null
    }
  }

  /**
   * Always convert any BEEF-like value to AtomicBEEF (number[]).
   * BTMS internal canonical BEEF type is number[] (AtomicBEEF).
   */
  private async toAtomicBeef(value: unknown, callId: string, context: string): Promise<AtomicBEEF | null> {
    try {
      // Already AtomicBEEF (number[])
      if (Array.isArray(value)) {
        return value as AtomicBEEF
      }

      // Uint8Array → convert to number[]
      if (value instanceof Uint8Array) {
        return Array.from(value) as AtomicBEEF
      }

      // Hex string → convert to number[]
      if (typeof value === 'string') {
        const hex = value.startsWith('0x') ? value.slice(2) : value
        if (hex.length % 2 !== 0) {
          btmsDebug(`${callId}: odd-length hex in ${context}`, { hex })
          return null
        }
        const arr: number[] = []
        for (let i = 0; i < hex.length; i += 2) {
          arr.push(parseInt(hex.substring(i, i + 2), 16))
        }
        return arr as AtomicBEEF
      }

      btmsDebug(`${callId}: unsupported BEEF type in ${context}`, {
        type: typeof value,
        value
      })
      return null
    } catch (e) {
      btmsDebug(`${callId}: toAtomicBeef FAILED in ${context}`, { error: e })
      return null
    }
  }

  // ------------------------------------------------------------
  // getTokens (new-world, ENTIRE TRANSACTION)
  // ------------------------------------------------------------
  async getTokens(assetId: string): Promise<BTMSWalletOutput[]> {
    const callId = makeDebugCallId('getTokens')
    btmsDebug(`${callId}: start`, { assetId })

    const args: ListOutputsArgs = {
      basket: this.basket,
      include: 'entire transactions', // <- crucial: we need tx + outputIndex
      includeTags: true,
      includeLabels: false,
      seekPermission: true,
      limit: 10000
    }

    const listResult = await this.walletClient.listOutputs(args)

    // Tell TypeScript these outputs are extended (have tx/outputIndex)
    const outputs = listResult.outputs as BTMSWalletOutput[]
    const filtered: BTMSWalletOutput[] = []

    for (const o of outputs) {
      if (!o.tx) {
        btmsDebug(`${callId}: skip output (no tx)`, { outpoint: o.outpoint })
        continue
      }

      const index = o.outputIndex ?? o.vout
      if (typeof index !== 'number') {
        btmsDebug(`${callId}: skip output (no outputIndex/vout)`, {
          outpoint: o.outpoint
        })
        continue
      }

      let tx: Transaction
      try {
        tx = Transaction.fromAtomicBEEF(o.tx as any)
      } catch (e) {
        btmsDebug(`${callId}: skip output (tx decode failed)`, {
          outpoint: o.outpoint,
          error: e
        })
        continue
      }

      const out = tx.outputs[index]
      if (!out || !out.lockingScript) {
        btmsDebug(`${callId}: skip output (no lockingScript in tx)`, {
          outpoint: o.outpoint
        })
        continue
      }

      // Canonical script hex
      const scriptHex = out.lockingScript.toHex() as HexString

      // -------------------------------------------------------
      // NEW: unified BTMS v2 decoding
      // -------------------------------------------------------
      const decoded = this.decodeBTMSToken(scriptHex)
      if (!decoded.valid) {
        btmsDebug(`${callId}: skip output (decodeBTMSToken invalid)`, {
          outpoint: o.outpoint
        })
        continue
      }

      // v2 always yields a proper assetId; fallback to ISSUE logic removed.
      if (decoded.assetId !== assetId) {
        btmsDebug(`${callId}: skip output (assetId mismatch)`, {
          outpoint: o.outpoint,
          decodedAssetId: decoded.assetId,
          want: assetId
        })
        continue
      }

      // Ensure downstream callers have a clean HEX lockingScript
      ; (o as any).lockingScript = scriptHex

      filtered.push(o)
    }

    btmsDebug(`${callId}: done`, { count: filtered.length })
    return filtered
  }

  /**
   * Compute total balance for a given assetId by discovering and decoding
   * its UTXOs. This now performs the basket lookup internally so callers
   * only pass `assetId`. This is 100% aligned with listAssets() Section 3.
   *
   * IMPORTANT:
   * - We ONLY count outputs that are owned by *this* identity:
   *     - owner self
   *     - owner <this.currentIdentity>
   *   Any other owner tag (e.g. owner <otherKey>) is treated as
   *   "given away" and does NOT contribute to this wallet's balance.
   */
  async getBalance(assetId: string): Promise<number> {
    const callId = makeDebugCallId('getBalance')
    btmsDebug(`${callId}: START`, { assetId, currentIdentity: this.currentIdentity })

    // ---------------------------------------------------------
    // 0) Discover UTXOs for this assetId via its basket
    // ---------------------------------------------------------
    const basket = `${TOKEN_BASKET_PREFIX} ${assetId}`

    const args: ListOutputsArgs = {
      basket,
      include: 'locking scripts',
      includeTags: true,
      includeLabels: true,
      seekPermission: true,
      limit: 10000
    }

    btmsDebug(`${callId}: listOutputs ARGS`, { basket, args })

    let result: ListOutputsResult
    try {
      result = await this.walletClient.listOutputs(args)
    } catch (err) {
      btmsDebug(`${callId}: listOutputs FAILED`, { basket, err })
      return 0
    }

    btmsDebug(`${callId}: listOutputs RESULT`, {
      assetId,
      basket,
      totalOutputs: result.totalOutputs,
      outputCount: result.outputs.length,
      preview: result.outputs.slice(0, 3)
    })

    const utxos = result.outputs
    let total = 0

    // ---------------------------------------------------------
    // 1) Decode each UTXO with unified BTMS decoder
    //    BUT ONLY if it belongs to this wallet.
    // ---------------------------------------------------------
    for (const o of utxos) {
      const outpoint = o.outpoint
      const tags: string[] = ((o as any).tags || []).filter((t: any) => typeof t === 'string')

      const ownerTag = tags.find(t => t.startsWith('owner '))
      const isOwnedBySelf =
        !ownerTag || // minted tokens with no explicit owner tag
        ownerTag === 'owner self' ||
        (this.currentIdentity && ownerTag === `owner ${this.currentIdentity}`)

      btmsDebug(`${callId}: UTXO TAGS`, {
        outpoint,
        tags,
        ownerTag,
        currentIdentity: this.currentIdentity,
        isOwnedBySelf
      })

      // Skip any UTXO that is explicitly tagged as belonging to someone else
      if (!isOwnedBySelf) {
        btmsDebug(`${callId}: SKIP non-self owner UTXO`, {
          outpoint,
          ownerTag
        })
        continue
      }

      const scriptHex = this.toLockingScriptHex((o as any).lockingScript, callId, 'getBalance')

      btmsDebug(`${callId}: lockingScriptHex`, { outpoint, scriptHex })
      if (!scriptHex) continue

      // ---------------------------------------------------------
      // 2) Unified BTMS decoder (same as listAssets)
      // ---------------------------------------------------------
      const decoded = this.decodeBTMSToken(scriptHex)

      // Narrow the union — only after this can we access assetId/amount/metadata
      if (!decoded.valid) {
        btmsDebug(`${callId}: decodeBTMSToken → INVALID`, {
          outpoint,
          scriptHexPreview: scriptHex?.slice(0, 40),
          fieldsLength: (decoded as any).fieldsLength
        })
        continue
      }

      const tokenName = decoded.assetId
      const possibleAmount = decoded.amount
      const possibleMetadata = decoded.metadata
      const signature = decoded.signature

      btmsDebug(`${callId}: classified fields`, {
        outpoint,
        tokenName,
        possibleAmount,
        possibleMetadata,
        signature,
        isValid: true
      })


      // Case-insensitive match since basket names may differ in case from token script assetId
      if (tokenName.toLowerCase() !== assetId.toLowerCase()) {
        btmsDebug(`${callId}: SKIP token mismatch`, { tokenName, assetId })
        continue
      }

      // ---------------------------------------------------------
      // 3) Extract amount
      // ---------------------------------------------------------
      const amount = Number(possibleAmount)
      if (!Number.isFinite(amount) || amount <= 0) continue

      // ---------------------------------------------------------
      // 4) Metadata (parse only for logging consistency)
      // ---------------------------------------------------------
      const metadataJson = possibleMetadata ?? '{}'
      try {
        JSON.parse(metadataJson)
      } catch (err) {
        btmsDebug(`${callId}: metadata JSON parse failed`, {
          outpoint,
          metadataJson,
          err
        })
      }

      // ---------------------------------------------------------
      // 5) Add to total
      // ---------------------------------------------------------
      total += amount
    }

    btmsDebug(`${callId}: TOTAL BALANCE`, { assetId, total })
    return total
  }

  /**
   * ISSUE: create brand-new BTMS tokens
   */
  async issue(
    amount: number,
    name: string,
    assetId: string,
    metadata: string,
    autoSwitchBasket = true
  ): Promise<BroadcastResponse | BroadcastFailure> {
    const callId = makeDebugCallId('issue')
    btmsDebug(`${callId}: START`, { amount, name, assetId, metadata })

    try {
      const basket: BasketStringUnder300Bytes = `${this.basketPrefix} ${ASSET_ID_VERSION} ${assetId}`

      btmsDebug(`${callId}: using per-token basket`, { basket })

      // unified identity lookup
      const { publicKey: myIdentityKey } = await this.walletClient.getPublicKey({
        identityKey: true
      })

      btmsDebug(`${callId}: issuer identity`, { myIdentityKey })

      const keyID = this.getRandomKeyID()
      btmsDebug(`${callId}: mint keyID`, { keyID })

      /**
       * ------------------------------------------------------------------
       * FIXED + HARDENED METADATA
       * ------------------------------------------------------------------
       * - Always enforces assetId and name.
       * - If caller passed metadata, merge it.
       * - Prevents empty {}, which broke PushDrop decode.
       */
      let metadataObj: any = {}

      try {
        const parsed = metadata && metadata.trim().length > 0 ? JSON.parse(metadata) : {}

        // Merge user metadata
        metadataObj = { ...parsed }
      } catch {
        metadataObj = {}
      }

      // Enforce required fields (cannot be removed by user)
      metadataObj.assetId = assetId
      metadataObj.name = name

      const metadataJson = JSON.stringify(metadataObj)

      btmsDebug(`${callId}: FINAL METADATA JSON`, { metadataJson })

      const token = new BTMSToken(this.walletClient)

      // STRICT 5-FIELD schema (signature="")
      const lockScript = await token.lock(
        this.protocolID,
        this.protocolKeyID,
        'self',
        assetId,
        amount,
        metadataJson,
        'ISSUE',
        '' // signature field required but empty for v1/v2
      )

      const lockingScriptHex = lockScript.toHex()

      // Use 'btms' label for discovery via listActions (no separate discovery output needed)
      const args: CreateActionArgs = {
        description: `Issue ${amount} ${name}`,
        labels: ['btms' as LabelStringUnder300Bytes],

        outputs: [
          {
            satoshis: this.satoshis,
            lockingScript: lockingScriptHex,
            basket,
            outputDescription: `${amount} new ${name}`,
            tags: ['btms', 'tokens', 'issue'] as OutputTagStringUnder300Bytes[],
            customInstructions: JSON.stringify({
              sender: myIdentityKey,
              keyID,
              amount,
              assetId,
              metadata: metadataJson
            })
          }
        ],

        options: {
          acceptDelayedBroadcast: false,
          randomizeOutputs: false
        }
      }

      btmsDebug(`${callId}: createAction ARGS`, args)

      const createActionResult = await this.walletClient.createAction(args)

      if (!createActionResult.tx) {
        throw new Error('Transaction is undefined. Action may be delayed.')
      }

      const broadcaster = new TopicBroadcaster(['tm_btms'], {
        networkPreset: 'local'
      })

      const finalResult = await broadcaster.broadcast(Transaction.fromAtomicBEEF(createActionResult.tx))

      btmsDebug(`${callId}: BROADCAST RESULT`, finalResult)

      if (autoSwitchBasket) {
        this.basket = basket
        btmsDebug(`${callId}: auto-switched active basket`, { basket })
      }

      return finalResult
    } catch (error: unknown) {
      throw error
    }
  }

  async switchIdentityToActiveProfile() {
    const callId = makeDebugCallId('switchIdentityToActiveProfile')
    btmsDebug(`${callId}: START`)

    // ----------------------------------------------------------
    // 0) WAIT UNTIL WALLET REPORTS A NEW IDENTITY
    // ----------------------------------------------------------
    const previousIdentity = this.currentIdentity
    let activeIdentityKey = previousIdentity

    for (let attempt = 0; attempt < 20; attempt++) {
      const { publicKey } = await this.walletClient.getPublicKey({ identityKey: true })
      activeIdentityKey = publicKey

      if (activeIdentityKey && activeIdentityKey !== previousIdentity) break

      await new Promise<void>(resolve => setTimeout(resolve, 50))
    }

    if (!activeIdentityKey || activeIdentityKey === previousIdentity) {
      btmsDebug(`${callId}: wallet never reported a NEW identity`, {
        previousIdentity,
        activeIdentityKey
      })
      return
    }

    try {
      // ----------------------------------------------------------
      // 1) Confirm active identity from wallet
      // ----------------------------------------------------------
      const { publicKey: confirmedKey } = await this.walletClient.getPublicKey({
        identityKey: true
      })

      btmsDebug(`${callId}: activeIdentityKey`, { confirmedKey })

      if (!confirmedKey || typeof confirmedKey !== 'string') {
        btmsDebug(`${callId}: identityKey UNDEFINED — aborting switch`)
        return
      }

      if (this.currentIdentity === confirmedKey) {
        btmsDebug(`${callId}: identity unchanged → SKIPPING full refresh`, {
          cachedIdentity: this.currentIdentity
        })
        return
      }

      // Apply new identity
      this.currentIdentity = confirmedKey

      // Force a fresh asset discovery after switching identity
      await this.listAssets('locking scripts')

      btmsDebug(`${callId}: walletClient remains unchanged`)

      // ----------------------------------------------------------
      // 2) Update messageboxes for this identity
      // ----------------------------------------------------------
      this.tokensMessageBox = `btms-v2-custody-${confirmedKey}`
      this.marketplaceMessageBox = `btms-v2-market-${confirmedKey}`
      this.basket = INIT_BASKET

      btmsDebug(`${callId}: updated messageboxes`, {
        tokensMessageBox: this.tokensMessageBox,
        marketplaceMessageBox: this.marketplaceMessageBox
      })

      // ----------------------------------------------------------
      // 3) Recreate tokenator
      // ----------------------------------------------------------
      this.tokenator = new MessageBoxTokenator(walletClient, this.tokensMessageBox)
      btmsDebug(`${callId}: tokenator recreated`)

      // 🔥 **CRITICAL FIX: must init() tokenator for new profile**
      await this.tokenator.init()
      btmsDebug(`${callId}: tokenator.init() complete`)

      // ----------------------------------------------------------
      // 4) Refresh asset list for new identity
      // ----------------------------------------------------------
      btmsDebug(`${callId}: refreshing assets after identity switch`)

      const refreshedAssets = await this.listAssets()

      if (this.setAssetsCallback) {
        this.setAssetsCallback(refreshedAssets)
      }

      // ----------------------------------------------------------
      // 5) Refresh incoming payments
      // ----------------------------------------------------------
      try {
        btmsDebug(`${callId}: refreshing incoming payments after identity switch`)
        await this.listIncomingPayments()
        btmsDebug(`${callId}: incoming payments refresh COMPLETE`)
      } catch (err: any) {
        btmsDebug(`${callId}: listIncomingPayments AFTER SWITCH FAILED (non-fatal)`, {
          message: err?.message,
          stack: err?.stack?.split('\n').slice(0, 2)
        })
      }

      btmsDebug(`${callId}: COMPLETE`, {
        assetsCount: refreshedAssets.length
      })
    } catch (err: any) {
      btmsDebug(`${callId}: ERROR`, {
        message: err?.message,
        stack: err?.stack?.split('\n').slice(0, 3)
      })
      throw err
    }
  }

  //     async send(
  //     assetId: string,
  //     recipient: string,
  //     sendAmount: number,
  //     onPaymentSent: (payment: TokenForRecipient) => void = () => {}
  //   ): Promise<SubmitResult> {
  //     const callId = makeDebugCallId('send')
  //     btmsDebug(`${callId}: START`, { assetId, recipient, sendAmount })

  //     try {
  //       /* ------------------------------------------------------------------ */
  //       /* 1) Fetch tokens + balance                                          */
  //       /* ------------------------------------------------------------------ */

  //       const myTokens = await this.getTokens(assetId)

  //       btmsDebug(`${callId}: getTokens RESULT`, {
  //         count: myTokens.length,
  //         firstOutpoint: myTokens[0]?.outpoint,
  //         firstVout: (myTokens[0] as any)?.vout ?? (myTokens[0] as any)?.outputIndex,
  //         hasTx: !!(myTokens[0] as any)?.tx
  //       })

  //       if (!Number.isFinite(sendAmount) || sendAmount <= 0) {
  //         throw new Error('BTMS send: amount must be greater than zero.')
  //       }

  //       const myBalance = await this.getBalance(assetId)
  //       btmsDebug(`${callId}: getBalance RESULT`, { myBalance })

  //       if (sendAmount > myBalance) {
  //         throw new Error('BTMS send: insufficient tokens.')
  //       }

  //       /* ------------------------------------------------------------- */
  //       /* 1B) Fetch spendable UTXO WITH FULL BEEF                       */
  //       /* ------------------------------------------------------------- */

  //       const tokenBasket = `${this.basketPrefix} ${ASSET_ID_VERSION} ${assetId}` as BasketStringUnder300Bytes

  //       btmsDebug(`${callId}: tokenBasket`, tokenBasket)

  //       const beefListArgs: ListOutputsArgs = {
  //         basket: tokenBasket,
  //         include: 'entire transactions',
  //         includeTags: true,
  //         includeLabels: true,
  //         seekPermission: true,
  //         limit: 100
  //       }

  //       btmsDebug(`${callId}: listOutputs ARGS (send BEEF fetch)`, beefListArgs)

  //       let beefResult: ListOutputsResult = {
  //         totalOutputs: 0,
  //         outputs: []
  //       }

  //       try {
  //         beefResult = await this.walletClient.listOutputs(beefListArgs)
  //       } catch (err) {
  //         btmsDebug(`${callId}: listOutputs FAILED beefResult:`, { beefResult })
  //         btmsDebug(`${callId}: listOutputs FAILED error:`, { err })
  //         throw new Error('BTMS send: failed to fetch BTMS UTXOs for send.')
  //       }

  //       btmsDebug(`${callId}: listOutputs RESULT (send BEEF fetch)`, {
  //         outputCount: beefResult.outputs.length,
  //         preview: beefResult.outputs.slice(0, 3),
  //         hasTopLevelBeef: !!(beefResult as any).BEEF
  //       })

  //       /* ------------------------------------------------------------------ */
  //       /*  NEW FIX: TOP-LEVEL BEEF DECODE (TS-SDK-CORRECT)                   */
  //       /* ------------------------------------------------------------------ */

  //       const topLevelBeefRaw = (beefResult as any).BEEF

  //       if (!topLevelBeefRaw) {
  //         throw new Error('BTMS send: wallet did not return full BEEF for token basket.')
  //       }

  //       let beefObj: Beef
  //       try {
  //         const beefArray = Utils.toArray(topLevelBeefRaw as any)
  //         beefObj = Beef.fromBinary(beefArray)
  //       } catch (error) {
  //         btmsDebug(`${callId}: failed to parse top-level BEEF`, { error })
  //         throw new Error('BTMS send: invalid prior transaction BEEF.')
  //       }

  //       btmsDebug(`${callId}: decoded BEEF`, {
  //         txCount: beefObj.txs.length
  //       })

  //       const spendableUtxo = beefResult.outputs.find(u => u.spendable && u.satoshis === 1)

  //       if (!spendableUtxo) {
  //         throw new Error('BTMS send: no spendable BTMS UTXO found for this asset.')
  //       }

  //       btmsDebug(`${callId}: chosen spendable utxo`, {
  //         outpoint: spendableUtxo.outpoint
  //       })

  //       const [txid, voutStr] = spendableUtxo.outpoint.split('.')
  //       const vout = Number(voutStr)

  //       const txEntry = beefObj.txs.find(t => t.txid === txid)

  //       if (!txEntry) {
  //         btmsDebug(`${callId}: ERROR — token TX not inside BEEF`, {
  //           txid,
  //           available: beefObj.txs.map(t => t.txid)
  //         })
  //         throw new Error('BTMS send: token TX not found inside BEEF.')
  //       }

  //       const atomicBEEF = beefObj.toBinaryAtomic(txid)

  //       btmsDebug(`${callId}: FINAL atomicBEEF`, {
  //         txid,
  //         byteLength: atomicBEEF.length
  //       })

  //       const first: BTMSWalletOutput = {
  //         ...spendableUtxo,
  //         tx: atomicBEEF,
  //         outputIndex: vout
  //       } as any

  //       /* ------------------------------------------------------------------ */
  //       /*  RE-JOIN ORIGINAL LOGIC (UNCHANGED BELOW THIS POINT)               */
  //       /* ------------------------------------------------------------------ */

  //       if (!(first as any).tx) {
  //         throw new Error('BTMS send: token UTXO is missing its BEEF.')
  //       }

  //       const inputIndex = (first as any).outputIndex ?? (first as any).vout

  //       if (typeof inputIndex !== 'number') {
  //         throw new Error('BTMS send: missing outputIndex/vout.')
  //       }

  //       const loadedBeef = Beef.fromBinary((first as any).tx as any)
  //       const prevTx = Transaction.fromAtomicBEEF((first as any).tx as any)
  //       const prevOut = prevTx.outputs[inputIndex]
  //       const scriptHex = prevOut.lockingScript.toHex() as HexString

  //       let decoded
  //       try {
  //         decoded = PushDrop.decode(LockingScript.fromHex(scriptHex))
  //       } catch {
  //         throw new Error('BTMS send: previous output is not BTMS PushDrop.')
  //       }

  //       const utf8Fields = decoded.fields.map(f => Utils.toUTF8(f))

  //       btmsDebug(`${callId}: PushDrop decoded UTF8 fields`, { utf8Fields })

  //       if (utf8Fields.length < 4) {
  //         throw new Error('BTMS send: malformed PushDrop (expected ≥4 fields).')
  //       }

  //       const tokenName = utf8Fields[0]
  //       const amtStr = utf8Fields[1]
  //       const op = utf8Fields[2]
  //       const metadataJson = utf8Fields[3]

  //       if (op !== 'ISSUE') {
  //         throw new Error(`BTMS send: expected "ISSUE" marker, got "${op}".`)
  //       }

  //       if (!metadataJson) {
  //         throw new Error('BTMS send: metadata JSON missing in PushDrop.')
  //       }

  //       const firstAmount = Number(amtStr)
  //       if (!Number.isFinite(firstAmount) || firstAmount <= 0) {
  //         throw new Error(`BTMS send: invalid amount: "${amtStr}".`)
  //       }

  //       if (tokenName !== assetId) {
  //         throw new Error(`BTMS send: token mismatch. Expected "${assetId}", got "${tokenName}".`)
  //       }

  //       let parsedMetadata: { name?: string } = {}
  //       try {
  //         parsedMetadata = JSON.parse(metadataJson)
  //       } catch {
  //         throw new Error('BTMS send: metadata JSON is invalid.')
  //       }

  //       const tokenDisplayName = parsedMetadata.name ?? assetId

  //       btmsDebug(`${callId}: classified PushDrop fields`, {
  //         tokenName,
  //         firstAmount,
  //         metadataJson,
  //         parsedName: tokenDisplayName
  //       })

  //       /* ------------------------------------------------------------------ */
  //       /* 2) Extract keyID for unlocking (OPTIONAL — OLD MINT SAFE)          */
  //       /* ------------------------------------------------------------------ */
  //       let unlockKeyID: string | undefined
  //       let rawCustomInstructions: any = undefined

  //       try {
  //         rawCustomInstructions = (first as any).customInstructions

  //         const parsed =
  //           typeof rawCustomInstructions === 'string' ? JSON.parse(rawCustomInstructions) : rawCustomInstructions || {}

  //         unlockKeyID = parsed.keyID

  //         btmsDebug(`${callId}: unlock metadata from customInstructions`, {
  //           hasCustomInstructions: !!rawCustomInstructions,
  //           parsed,
  //           unlockKeyID
  //         })
  //       } catch (err) {
  //         btmsDebug(`${callId}: customInstructions parse error (NON-FATAL)`, {
  //           rawCustomInstructions,
  //           err
  //         })
  //       }

  //       if (!unlockKeyID) {
  //         btmsDebug(`${callId}: WARNING — previous token UTXO has NO keyID (old mint). Using protocol key only.`, {})
  //       }

  //       btmsDebug(`${callId}: unlock keyID (optional)`, { unlockKeyID })

  //       /* ------------------------------------------------------------------ */
  //       /* 3) Load sender identity (current profile’s identity key)           */
  //       /* ------------------------------------------------------------------ */

  //       const { publicKey: myIdentityKey } = await this.walletClient.getPublicKey({
  //         identityKey: true
  //       })

  //       btmsDebug(`${callId}: getPublicKey RESULT`, { myIdentityKey })

  //       /* ------------------------------------------------------------------ */
  //       /* 4) Build recipient + change outputs with BTMSToken.lock()          */
  //       /* ------------------------------------------------------------------ */

  //       const template = new BTMSToken(walletClient)
  //       const outputs: CreateActionOutput[] = []

  //       /* ---------------------- */
  //       /* Recipient Output       */
  //       /* ---------------------- */

  //       const recipientKeyID = this.getRandomKeyID()

  //       btmsDebug(`${callId}: RECIPIENT: building lock()`, {
  //         assetId,
  //         sendAmount,
  //         metadataJson,
  //         recipientKeyID,
  //         recipient
  //       })

  //       const recipientLockScript = await template.lock(
  //         PROTOCOL_ID,
  //         PROTOCOL_KEY_ID,
  //         'self',
  //         assetId,
  //         sendAmount,
  //         metadataJson
  //       )

  //       const recipientScriptHex = recipientLockScript.toHex() as HexString

  //       btmsDebug(`${callId}: RECIPIENT lock() RESULT`, {
  //         scriptPreview: shortHex(recipientScriptHex, 48),
  //         fullLength: recipientScriptHex.length,
  //         sendAmount,
  //         metadataJson
  //       })

  //       /* ------------------------------------------------------------------ */
  //       /* SYMMETRY TEST: ensure outgoing token is decodable (strict v2)      */
  //       /* ------------------------------------------------------------------ */

  //       try {
  //         const d = this.decodeBTMSToken(recipientScriptHex)

  //         if (!d.valid) {
  //           throw new Error('decodeBTMSToken returned invalid structure for outgoing BTMS token')
  //         }

  //         if (!d.assetId || typeof d.assetId !== 'string') {
  //           throw new Error('BTMS send: missing assetId in PushDrop.')
  //         }

  //         if (!Number.isFinite(d.amount) || d.amount <= 0) {
  //           throw new Error('BTMS send: invalid amount in PushDrop.')
  //         }

  //         if (!d.metadata || typeof d.metadata !== 'string') {
  //           throw new Error('BTMS send: missing metadata JSON in PushDrop.')
  //         }

  //         if (d.op !== 'ISSUE' && d.op !== 'TRANSFER') {
  //           throw new Error(`BTMS send: malformed token — expected ISSUE/TRANSFER, got ${d.op}`)
  //         }
  //       } catch (e) {
  //         btmsDebug(`${callId}: SYMMETRY CHECK FAILED`, { e })
  //         throw new Error('BTMS send: outgoing token failed symmetry decode check.')
  //       }

  //       const recipientOutput: CreateActionOutput = {
  //         satoshis: this.satoshis,
  //         lockingScript: recipientScriptHex,
  //         outputDescription: `Send ${sendAmount} ${tokenDisplayName}`,
  //         tags: [myIdentityKey === recipient ? 'owner self' : `owner ${recipient}`] as OutputTagStringUnder300Bytes[]
  //       }

  //       // FULL new-world customInstructions
  //       recipientOutput.customInstructions = JSON.stringify({
  //         sender: myIdentityKey,
  //         keyID: recipientKeyID,
  //         amount: sendAmount,
  //         assetId,
  //         metadata: metadataJson
  //       })

  //       btmsDebug(`${callId}: RECIPIENT customInstructions`, {
  //         customInstructions: recipientOutput.customInstructions
  //       })

  //       // 🔴 FIX: ALWAYS keep tokens inside the per-asset basket
  //       // so both sender and receiver profiles can discover them.
  //       recipientOutput.basket = tokenBasket

  //       outputs.push(recipientOutput)

  // /* -------------------------------------------------------- */
  // /* REQUIRED: Discovery Output (IDENTICAL to issue())        */
  // /* -------------------------------------------------------- */

  // const discoveryTemplate = new BTMSFundingToken(walletClient);

  // const discoveryLockScript = await discoveryTemplate.lock(
  //   this.protocolID,
  //   this.protocolKeyID,
  //   "self"
  // );

  // const discoveryLockingScriptHex = discoveryLockScript.toHex() as HexString;

  // // Strong-typed discovery label
  // const discoveryLabel: LabelStringUnder300Bytes =
  //   `${PROTOCOL} ${ASSET_ID_VERSION} ${ASSET_ID_TERM}=${assetId}` as LabelStringUnder300Bytes;

  // const discoveryOutput: CreateActionOutput = {
  //   satoshis: 1,
  //   lockingScript: discoveryLockingScriptHex,
  //   basket: DISCOVERY_BASKET as BasketStringUnder300Bytes,
  //   outputDescription: `discovery ${discoveryLabel}`,
  //   tags: ["btms-discovery"] as OutputTagStringUnder300Bytes[],
  // };

  // btmsDebug(`${callId}: DISCOVERY OUTPUT (send)`, {
  //   discoveryLabel,
  //   lockingScriptPreview: shortHex(discoveryLockingScriptHex, 48),
  // });

  // outputs.push(discoveryOutput);

  //       /* ---------------------- */
  //       /* Change Output          */
  //       /* ---------------------- */

  //       const changeAmount = firstAmount - sendAmount

  //       btmsDebug(`${callId}: CHANGE: computed`, {
  //         firstAmount,
  //         sendAmount,
  //         changeAmount
  //       })

  //       if (changeAmount > 0) {
  //         const changeLockScript = await template.lock(
  //           PROTOCOL_ID,
  //           PROTOCOL_KEY_ID,
  //           'self',
  //           assetId,
  //           changeAmount,
  //           metadataJson
  //         )

  //         const changeScriptHex = changeLockScript.toHex() as HexString

  //         btmsDebug(`${callId}: CHANGE lock() RESULT`, {
  //           scriptPreview: shortHex(changeScriptHex, 48),
  //           fullLength: changeScriptHex.length,
  //           changeAmount
  //         })

  //         const changeOutput: CreateActionOutput = {
  //           satoshis: this.satoshis,
  //           lockingScript: changeScriptHex,
  //           basket: tokenBasket,
  //           outputDescription: `Keep ${changeAmount} ${tokenDisplayName}`,
  //           tags: ['owner self'] as OutputTagStringUnder300Bytes[],
  //           customInstructions: JSON.stringify({
  //             sender: myIdentityKey,
  //             keyID: this.getRandomKeyID(),
  //             amount: changeAmount,
  //             assetId,
  //             metadata: metadataJson
  //           })
  //         }

  //         btmsDebug(`${callId}: CHANGE customInstructions`, {
  //           customInstructions: changeOutput.customInstructions
  //         })

  //         outputs.push(changeOutput)
  //       }

  //       /* ------------------------------------------------------------------ */
  //       /* 5) createAction (protected protocol)                               */
  //       /* ------------------------------------------------------------------ */

  //       const createActionArgs: CreateActionArgs = {
  //         description: `Send ${sendAmount} ${tokenDisplayName} to ${recipient}`,
  //         labels: [assetId as LabelStringUnder300Bytes],
  //         inputBEEF: loadedBeef.toBinary(),
  //         inputs: [
  //           {
  //             outpoint: (first.outpoint ?? `${prevTx.id('hex')}.${inputIndex}`) as OutpointString,
  //             unlockingScriptLength: 74,
  //             inputDescription: `Spend ${tokenDisplayName} BTMS token`
  //           }
  //         ],
  //         outputs,
  //         options: {
  //           acceptDelayedBroadcast: false,
  //           randomizeOutputs: false
  //         }
  //       }

  //       btmsDebug(`${callId}: createAction ARGS`, {
  //         description: createActionArgs.description,
  //         labels: createActionArgs.labels,
  //         inputs: createActionArgs.inputs,
  //         outputsCount: createActionArgs.outputs?.length ?? 0
  //       })

  //       const createActionResult = await this.walletClient.createAction(createActionArgs)

  //       btmsDebug(`${callId}: createAction RESULT`, {
  //         hasSignable: !!createActionResult.signableTransaction
  //       })

  //       const { signableTransaction } = createActionResult

  //       if (!signableTransaction) {
  //         throw new Error('BTMS send: createAction -> no signableTransaction.')
  //       }

  //       /* ------------------------------------------------------------------ */
  //       /* 6) Unlocking script via PushDrop.unlock                            */
  //       /* ------------------------------------------------------------------ */

  //       const txForSigning = Transaction.fromAtomicBEEF(signableTransaction.tx)

  //       const unlocker = new PushDrop(walletClient).unlock(PROTOCOL_ID, PROTOCOL_KEY_ID, 'self')

  //       btmsDebug(`${callId}: unlocker.sign ARGS`, {
  //         txid: txForSigning.id('hex'),
  //         inputIndex: 0
  //       })

  //       const unlockingScript = await unlocker.sign(txForSigning, 0)

  //       btmsDebug(`${callId}: unlocker.sign RESULT`, {
  //         unlockingScriptPreview: shortHex(unlockingScript.toHex(), 48)
  //       })

  //       /* ------------------------------------------------------------------ */
  //       /* 7) signAction (protected protocol)                                 */
  //       /* ------------------------------------------------------------------ */

  //       const signActionArgs: SignActionArgs = {
  //         reference: signableTransaction.reference,
  //         spends: {
  //           0: { unlockingScript: unlockingScript.toHex() }
  //         }
  //       }

  //       btmsDebug(`${callId}: signAction ARGS`, signActionArgs)

  //       const signResult = await this.walletClient.signAction(signActionArgs)

  //       btmsDebug(`${callId}: signAction RESULT`, {
  //         hasTx: !!signResult.tx
  //       })

  //       if (!signResult.tx) {
  //         throw new Error('BTMS send: signAction missing tx.')
  //       }

  //       const finalTxObj = Transaction.fromAtomicBEEF(signResult.tx)
  //       const finalTxid = finalTxObj.id('hex') as TXIDHexString

  //       /* ------------------------------------------------------------------ */
  //       /* 8) TokenForRecipient + message-box send                            */
  //       /* ------------------------------------------------------------------ */

  //       const tokenForRecipient: TokenForRecipient = {
  //         txid: finalTxid,
  //         vout: 0,
  //         lockingScript: recipientScriptHex,
  //         amount: sendAmount,
  //         satoshis: this.satoshis,
  //         beefPayload: Utils.toArray(signResult.tx),
  //         beef: signResult.tx,
  //         keyID: recipientKeyID
  //       }

  //       btmsDebug(`${callId}: tokenForRecipient`, {
  //         txid: tokenForRecipient.txid,
  //         amount: tokenForRecipient.amount,
  //         keyID: tokenForRecipient.keyID
  //       })

  //       /* ------------------------------------------------------------------ */
  //       /* 8B) SEND MESSAGE TO RECIPIENT’S CUSTODY BOX                        */
  //       /* ------------------------------------------------------------------ */

  //       if (myIdentityKey !== recipient) {
  //         const recipientCustodyBox = `btms-v2-custody-${recipient}` as LabelStringUnder300Bytes

  //         const sendMessageArgs = {
  //           recipient,
  //           messageBox: recipientCustodyBox,
  //           body: JSON.stringify({ token: tokenForRecipient })
  //         }

  //         btmsDebug(`${callId}: message-box sendMessage ARGS`, sendMessageArgs)

  //         await this.tokenator.sendMessage(sendMessageArgs)

  //         btmsDebug(`${callId}: message-box sendMessage RESULT`, { ok: true })
  //       }

  //       try {
  //         onPaymentSent(tokenForRecipient)
  //       } catch (err) {
  //         btmsDebug(`${callId}: onPaymentSent callback threw`, { err })
  //       }

  //       /* ------------------------------------------------------------------ */
  //       /* 9) Broadcast via TopicBroadcaster                                  */
  //       /* ------------------------------------------------------------------ */

  //       const broadcasterArgs = {
  //         topics: ['tm_btms'],
  //         options: {
  //           networkPreset: 'local' as const
  //         }
  //       }

  //       btmsDebug(`${callId}: TopicBroadcaster ARGS`, broadcasterArgs)

  //       const broadcaster = new TopicBroadcaster(broadcasterArgs.topics, broadcasterArgs.options)

  //       const broadcastResult = await broadcaster.broadcast(finalTxObj)

  //       btmsDebug(`${callId}: broadcast RESULT`, broadcastResult)

  //       if (broadcastResult.status !== 'success') {
  //         throw new Error(`BTMS send: broadcast failed: ${(broadcastResult as any).reason}`)
  //       }

  //       btmsDebug(`${callId}: COMPLETE`, { finalTxid })

  //       return { status: 'success', topics: {} }
  //     } catch (error: any) {
  //       if (error instanceof WERR_REVIEW_ACTIONS) {
  //         console.error('BTMS SEND: WERR_REVIEW_ACTIONS', {
  //           code: error.code,
  //           message: error.message,
  //           reviewActionResults: error.reviewActionResults
  //         })
  //       } else {
  //         console.error('BTMS SEND: unexpected', error)
  //       }

  //       btmsDebug(`${callId}: FINAL ERROR`, {
  //         message: error?.message,
  //         stack: error?.stack
  //       })

  //       throw error
  //     }
  //   }

  // ---------------------------------------------------------------
  // SEND() — With Diagnostic Enrichment
  // ---------------------------------------------------------------
  /******************************************************************************************
   * INSTRUMENTED send()
   ******************************************************************************************/
  async send(
    assetId: string,
    recipient: string,
    sendAmount: number,
    onPaymentSent: (payment: TokenForRecipient) => void = () => { }
  ): Promise<SubmitResult> {
    const callId = makeDebugCallId('send')
    btmsDebug(`${callId}: START`, { assetId, recipient, sendAmount })

    try {
      /* ------------------------------------------------------------------ */
      /* 1) Fetch tokens + balance                                          */
      /* ------------------------------------------------------------------ */

      const myTokens = await this.getTokens(assetId)

      btmsDebug(`${callId}: getTokens RESULT`, {
        count: myTokens.length,
        firstOutpoint: myTokens[0]?.outpoint,
        firstVout: (myTokens[0] as any)?.vout ?? (myTokens[0] as any)?.outputIndex,
        hasTx: !!(myTokens[0] as any)?.tx
      })

      if (!Number.isFinite(sendAmount) || sendAmount <= 0) {
        throw new Error('BTMS send: amount must be greater than zero.')
      }

      const myBalance = await this.getBalance(assetId)
      btmsDebug(`${callId}: getBalance RESULT`, { myBalance })

      if (sendAmount > myBalance) {
        throw new Error('BTMS send: insufficient tokens.')
      }

      /* ------------------------------------------------------------- */
      /* 1B) Fetch spendable UTXO WITH FULL BEEF                       */
      /* ------------------------------------------------------------- */

      const tokenBasket = `${this.basketPrefix} ${ASSET_ID_VERSION} ${assetId}` as BasketStringUnder300Bytes

      btmsDebug(`${callId}: tokenBasket`, tokenBasket)

      const beefListArgs: ListOutputsArgs = {
        basket: tokenBasket,
        include: 'entire transactions',
        includeTags: true,
        includeLabels: true,
        seekPermission: true,
        limit: 100
      }

      btmsDebug(`${callId}: listOutputs ARGS (send BEEF fetch)`, beefListArgs)

      let beefResult: ListOutputsResult = {
        totalOutputs: 0,
        outputs: []
      }

      try {
        beefResult = await this.walletClient.listOutputs(beefListArgs)
      } catch (err) {
        btmsDebug(`${callId}: listOutputs FAILED beefResult:`, { beefResult })
        btmsDebug(`${callId}: listOutputs FAILED error:`, { err })
        throw new Error('BTMS send: failed to fetch BTMS UTXOs for send.')
      }

      btmsDebug(`${callId}: listOutputs RESULT (send BEEF fetch)`, {
        outputCount: beefResult.outputs.length,
        preview: beefResult.outputs.slice(0, 3),
        hasTopLevelBeef: !!(beefResult as any).BEEF
      })

      /* ------------------------------------------------------------------ */
      /*  NEW FIX: TOP-LEVEL BEEF DECODE (TS-SDK-CORRECT)                   */
      /* ------------------------------------------------------------------ */

      const topLevelBeefRaw = (beefResult as any).BEEF

      if (!topLevelBeefRaw) {
        throw new Error('BTMS send: wallet did not return full BEEF for token basket.')
      }

      let beefObj: Beef
      try {
        const beefArray = Utils.toArray(topLevelBeefRaw as any)
        beefObj = Beef.fromBinary(beefArray)
      } catch (error) {
        btmsDebug(`${callId}: failed to parse top-level BEEF`, { error })
        throw new Error('BTMS send: invalid prior transaction BEEF.')
      }

      btmsDebug(`${callId}: decoded BEEF`, {
        txCount: beefObj.txs.length
      })

      const spendableUtxo = beefResult.outputs.find(u => u.spendable && u.satoshis === 1)

      if (!spendableUtxo) {
        throw new Error('BTMS send: no spendable BTMS UTXO found for this asset.')
      }

      btmsDebug(`${callId}: chosen spendable utxo`, {
        outpoint: spendableUtxo.outpoint
      })

      const [txid, voutStr] = spendableUtxo.outpoint.split('.')
      const vout = Number(voutStr)

      const txEntry = beefObj.txs.find(t => t.txid === txid)

      if (!txEntry) {
        btmsDebug(`${callId}: ERROR — token TX not inside BEEF`, {
          txid,
          available: beefObj.txs.map(t => t.txid)
        })
        throw new Error('BTMS send: token TX not found inside BEEF.')
      }

      const atomicBEEF = beefObj.toBinaryAtomic(txid)

      btmsDebug(`${callId}: FINAL atomicBEEF`, {
        txid,
        byteLength: atomicBEEF.length
      })

      const first: BTMSWalletOutput = {
        ...spendableUtxo,
        tx: atomicBEEF,
        outputIndex: vout
      } as any

      /* ------------------------------------------------------------------ */
      /*  RE-JOIN ORIGINAL LOGIC (UNCHANGED BELOW THIS POINT)               */
      /* ------------------------------------------------------------------ */

      if (!(first as any).tx) {
        throw new Error('BTMS send: token UTXO is missing its BEEF.')
      }

      const inputIndex = (first as any).outputIndex ?? (first as any).vout

      if (typeof inputIndex !== 'number') {
        throw new Error('BTMS send: missing outputIndex/vout.')
      }

      const loadedBeef = Beef.fromBinary((first as any).tx as any)
      const prevTx = Transaction.fromAtomicBEEF((first as any).tx as any)
      const prevOut = prevTx.outputs[inputIndex]
      const scriptHex = prevOut.lockingScript.toHex() as HexString

      let decoded
      try {
        decoded = PushDrop.decode(LockingScript.fromHex(scriptHex))
      } catch {
        throw new Error('BTMS send: previous output is not BTMS PushDrop.')
      }

      const utf8Fields = decoded.fields.map(f => Utils.toUTF8(f))

      btmsDebug(`${callId}: PushDrop decoded UTF8 fields`, { utf8Fields })

      if (utf8Fields.length < 4) {
        throw new Error('BTMS send: malformed PushDrop (expected ≥4 fields).')
      }

      const tokenName = utf8Fields[0]
      const amtStr = utf8Fields[1]
      const op = utf8Fields[2]
      const metadataJson = utf8Fields[3]

      if (op !== 'ISSUE') {
        throw new Error(`BTMS send: expected "ISSUE" marker, got "${op}".`)
      }

      if (!metadataJson) {
        throw new Error('BTMS send: metadata JSON missing in PushDrop.')
      }

      const firstAmount = Number(amtStr)
      if (!Number.isFinite(firstAmount) || firstAmount <= 0) {
        throw new Error(`BTMS send: invalid amount: "${amtStr}".`)
      }

      if (tokenName.toLowerCase() !== assetId.toLowerCase()) {
        throw new Error(`BTMS send: token mismatch. Expected "${assetId}", got "${tokenName}".`)
      }

      let parsedMetadata: { name?: string } = {}
      try {
        parsedMetadata = JSON.parse(metadataJson)
      } catch {
        throw new Error('BTMS send: metadata JSON is invalid.')
      }

      const tokenDisplayName = parsedMetadata.name ?? assetId

      btmsDebug(`${callId}: classified PushDrop fields`, {
        tokenName,
        firstAmount,
        metadataJson,
        parsedName: tokenDisplayName
      })

      /* ------------------------------------------------------------------ */
      /* 2) Extract keyID for unlocking (OPTIONAL — OLD MINT SAFE)          */
      /* ------------------------------------------------------------------ */
      let unlockKeyID: string | undefined
      let rawCustomInstructions: any = undefined

      try {
        rawCustomInstructions = (first as any).customInstructions

        const parsed =
          typeof rawCustomInstructions === 'string' ? JSON.parse(rawCustomInstructions) : rawCustomInstructions || {}

        unlockKeyID = parsed.keyID

        btmsDebug(`${callId}: unlock metadata from customInstructions`, {
          hasCustomInstructions: !!rawCustomInstructions,
          parsed,
          unlockKeyID
        })
      } catch (err) {
        btmsDebug(`${callId}: customInstructions parse error (NON-FATAL)`, {
          rawCustomInstructions,
          err
        })
      }

      if (!unlockKeyID) {
        btmsDebug(`${callId}: WARNING — previous token UTXO has NO keyID (old mint). Using protocol key only.`, {})
      }

      btmsDebug(`${callId}: unlock keyID (optional)`, { unlockKeyID })

      /* ------------------------------------------------------------------ */
      /* 3) Load sender identity (current profile’s identity key)           */
      /* ------------------------------------------------------------------ */

      const { publicKey: myIdentityKey } = await this.walletClient.getPublicKey({
        identityKey: true
      })

      btmsDebug(`${callId}: getPublicKey RESULT`, { myIdentityKey })

      /* ------------------------------------------------------------------ */
      /* 4) Build recipient + change outputs with BTMSToken.lock()          */
      /* ------------------------------------------------------------------ */

      const template = new BTMSToken(walletClient)
      const outputs: CreateActionOutput[] = []

      /* ---------------------- */
      /* Recipient Output       */
      /* ---------------------- */

      const recipientKeyID = this.getRandomKeyID()

      btmsDebug(`${callId}: RECIPIENT: building lock()`, {
        assetId,
        sendAmount,
        metadataJson,
        recipientKeyID,
        recipient
      })

      const recipientLockScript = await template.lock(
        PROTOCOL_ID,
        PROTOCOL_KEY_ID,
        'self',
        assetId,
        sendAmount,
        metadataJson
      )

      const recipientScriptHex = recipientLockScript.toHex() as HexString

      btmsDebug(`${callId}: RECIPIENT lock() RESULT`, {
        scriptPreview: shortHex(recipientScriptHex, 48),
        fullLength: recipientScriptHex.length,
        sendAmount,
        metadataJson
      })

      /* ------------------------------------------------------------------ */
      /* SYMMETRY TEST: ensure outgoing token is decodable (strict v2)      */
      /* ------------------------------------------------------------------ */

      try {
        const d = this.decodeBTMSToken(recipientScriptHex)

        if (!d.valid) {
          throw new Error('decodeBTMSToken returned invalid structure for outgoing BTMS token')
        }

        if (!d.assetId || typeof d.assetId !== 'string') {
          throw new Error('BTMS send: missing assetId in PushDrop.')
        }

        if (!Number.isFinite(d.amount) || d.amount <= 0) {
          throw new Error('BTMS send: invalid amount in PushDrop.')
        }

        if (!d.metadata || typeof d.metadata !== 'string') {
          throw new Error('BTMS send: missing metadata JSON in PushDrop.')
        }

        if (d.op !== 'ISSUE' && d.op !== 'TRANSFER') {
          throw new Error(`BTMS send: malformed token — expected ISSUE/TRANSFER, got ${d.op}`)
        }
      } catch (e) {
        btmsDebug(`${callId}: SYMMETRY CHECK FAILED`, { e })
        throw new Error('BTMS send: outgoing token failed symmetry decode check.')
      }

      const recipientOutput: CreateActionOutput = {
        satoshis: this.satoshis,
        lockingScript: recipientScriptHex,
        outputDescription: `Send ${sendAmount} ${tokenDisplayName}`,
        tags: [myIdentityKey === recipient ? 'owner self' : `owner ${recipient}`] as OutputTagStringUnder300Bytes[]
      }

      // FULL new-world customInstructions
      recipientOutput.customInstructions = JSON.stringify({
        sender: myIdentityKey,
        keyID: recipientKeyID,
        amount: sendAmount,
        assetId,
        metadata: metadataJson
      })

      btmsDebug(`${callId}: RECIPIENT customInstructions`, {
        customInstructions: recipientOutput.customInstructions
      })

      // 🔴 FIX: ALWAYS keep tokens inside the per-asset basket
      // so both sender and receiver profiles can discover them.
      recipientOutput.basket = tokenBasket

      outputs.push(recipientOutput)

      /* ---------------------- */
      /* Change Output          */
      /* ---------------------- */

      const changeAmount = firstAmount - sendAmount

      btmsDebug(`${callId}: CHANGE: computed`, {
        firstAmount,
        sendAmount,
        changeAmount
      })

      if (changeAmount > 0) {
        const changeLockScript = await template.lock(
          PROTOCOL_ID,
          PROTOCOL_KEY_ID,
          'self',
          assetId,
          changeAmount,
          metadataJson
        )

        const changeScriptHex = changeLockScript.toHex() as HexString

        btmsDebug(`${callId}: CHANGE lock() RESULT`, {
          scriptPreview: shortHex(changeScriptHex, 48),
          fullLength: changeScriptHex.length,
          changeAmount
        })

        const changeOutput: CreateActionOutput = {
          satoshis: this.satoshis,
          lockingScript: changeScriptHex,
          basket: tokenBasket,
          outputDescription: `Keep ${changeAmount} ${tokenDisplayName}`,
          tags: ['owner self'] as OutputTagStringUnder300Bytes[],
          customInstructions: JSON.stringify({
            sender: myIdentityKey,
            keyID: this.getRandomKeyID(),
            amount: changeAmount,
            assetId,
            metadata: metadataJson
          })
        }

        btmsDebug(`${callId}: CHANGE customInstructions`, {
          customInstructions: changeOutput.customInstructions
        })

        outputs.push(changeOutput)
      }

      /* ------------------------------------------------------------------ */
      /* 5) createAction (protected protocol)                               */
      /* ------------------------------------------------------------------ */

      const createActionArgs: CreateActionArgs = {
        description: `Send ${sendAmount} ${tokenDisplayName} to ${recipient}`,
        labels: ['btms' as LabelStringUnder300Bytes],
        inputBEEF: loadedBeef.toBinary(),
        inputs: [
          {
            outpoint: (first.outpoint ?? `${prevTx.id('hex')}.${inputIndex}`) as OutpointString,
            unlockingScriptLength: 74,
            inputDescription: `Spend ${tokenDisplayName} BTMS token`
          }
        ],
        outputs,
        options: {
          acceptDelayedBroadcast: false,
          randomizeOutputs: false
        }
      }

      btmsDebug(`${callId}: createAction ARGS`, {
        description: createActionArgs.description,
        labels: createActionArgs.labels,
        inputs: createActionArgs.inputs,
        outputsCount: createActionArgs.outputs?.length ?? 0
      })

      const createActionResult = await this.walletClient.createAction(createActionArgs)

      btmsDebug(`${callId}: createAction RESULT`, {
        hasSignable: !!createActionResult.signableTransaction
      })

      const { signableTransaction } = createActionResult

      if (!signableTransaction) {
        throw new Error('BTMS send: createAction -> no signableTransaction.')
      }

      /* ------------------------------------------------------------------ */
      /* 6) Unlocking script via PushDrop.unlock                            */
      /* ------------------------------------------------------------------ */

      const txForSigning = Transaction.fromAtomicBEEF(signableTransaction.tx)

      const unlocker = new PushDrop(walletClient).unlock(PROTOCOL_ID, PROTOCOL_KEY_ID, 'self')

      btmsDebug(`${callId}: unlocker.sign ARGS`, {
        txid: txForSigning.id('hex'),
        inputIndex: 0
      })

      const unlockingScript = await unlocker.sign(txForSigning, 0)

      btmsDebug(`${callId}: unlocker.sign RESULT`, {
        unlockingScriptPreview: shortHex(unlockingScript.toHex(), 48)
      })

      /* ------------------------------------------------------------------ */
      /* 7) signAction (protected protocol)                                 */
      /* ------------------------------------------------------------------ */

      const signActionArgs: SignActionArgs = {
        reference: signableTransaction.reference,
        spends: {
          0: { unlockingScript: unlockingScript.toHex() }
        }
      }

      btmsDebug(`${callId}: signAction ARGS`, signActionArgs)

      const signResult = await this.walletClient.signAction(signActionArgs)

      btmsDebug(`${callId}: signAction RESULT`, {
        hasTx: !!signResult.tx
      })

      if (!signResult.tx) {
        throw new Error('BTMS send: signAction missing tx.')
      }

      const finalTxObj = Transaction.fromAtomicBEEF(signResult.tx)
      const finalTxid = finalTxObj.id('hex') as TXIDHexString

      /* ------------------------------------------------------------------ */
      /* 8) TokenForRecipient + message-box send                            */
      /* ------------------------------------------------------------------ */

      const tokenForRecipient: TokenForRecipient = {
        txid: finalTxid,
        vout: 0,
        lockingScript: recipientScriptHex,
        amount: sendAmount,
        satoshis: this.satoshis,
        beefPayload: Utils.toArray(signResult.tx),
        beef: signResult.tx,
        keyID: recipientKeyID
      }

      btmsDebug(`${callId}: tokenForRecipient`, {
        txid: tokenForRecipient.txid,
        amount: tokenForRecipient.amount,
        keyID: tokenForRecipient.keyID
      })

      /* ------------------------------------------------------------------ */
      /* 8B) SEND MESSAGE TO RECIPIENT’S CUSTODY BOX                        */
      /* ------------------------------------------------------------------ */

      if (myIdentityKey !== recipient) {
        const recipientCustodyBox = `btms-v2-custody-${recipient}` as LabelStringUnder300Bytes

        const sendMessageArgs = {
          recipient,
          messageBox: recipientCustodyBox,
          body: JSON.stringify({ token: tokenForRecipient })
        }

        btmsDebug(`${callId}: message-box sendMessage ARGS`, sendMessageArgs)

        await this.tokenator.sendMessage(sendMessageArgs)

        btmsDebug(`${callId}: message-box sendMessage RESULT`, { ok: true })
      }

      try {
        onPaymentSent(tokenForRecipient)
      } catch (err) {
        btmsDebug(`${callId}: onPaymentSent callback threw`, { err })
      }

      /* ------------------------------------------------------------------ */
      /* 9) Broadcast via TopicBroadcaster                                  */
      /* ------------------------------------------------------------------ */

      const broadcasterArgs = {
        topics: ['tm_btms'],
        options: {
          networkPreset: 'local' as const
        }
      }

      btmsDebug(`${callId}: TopicBroadcaster ARGS`, broadcasterArgs)

      const broadcaster = new TopicBroadcaster(broadcasterArgs.topics, broadcasterArgs.options)

      const broadcastResult = await broadcaster.broadcast(finalTxObj)

      btmsDebug(`${callId}: broadcast RESULT`, broadcastResult)

      if (broadcastResult.status !== 'success') {
        throw new Error(`BTMS send: broadcast failed: ${(broadcastResult as any).reason}`)
      }

      btmsDebug(`${callId}: COMPLETE`, { finalTxid })

      return { status: 'success', topics: {} }
    } catch (error: any) {
      if (error instanceof WERR_REVIEW_ACTIONS) {
        console.error('BTMS SEND: WERR_REVIEW_ACTIONS', {
          code: error.code,
          message: error.message,
          reviewActionResults: error.reviewActionResults
        })
      } else {
        console.error('BTMS SEND: unexpected', error)
      }

      btmsDebug(`${callId}: FINAL ERROR`, {
        message: error?.message,
        stack: error?.stack
      })

      throw error
    }
  }

  /******************************************************************************************
   * listAssets() — Uses listActions with 'btms' label for discovery (no discovery basket)
   ******************************************************************************************/
  async listAssets(includeMode: ListOutputsArgs['include'] = 'locking scripts'): Promise<Asset[]> {
    const callId = makeDebugCallId('listAssets')
    btmsDebug(`${callId}: START (listActions + messagebox scan)`, { includeMode })

    const assetIds = new Set<string>()

    /***************************************************************************
     * STEP A — Discover assets via listActions with 'btms' label
     * Extract asset IDs from output baskets (pattern: "btmstoken v1 <assetId>")
     ***************************************************************************/
    try {
      const actionsResult: ListActionsResult = await this.walletClient.listActions({
        labels: ['btms'],
        includeOutputs: true,
        limit: 10000
      })

      btmsDebug(`${callId}: listActions result`, {
        totalActions: actionsResult.totalActions,
        returnedActions: actionsResult.actions.length
      })

      // Extract asset IDs from output baskets
      const basketPrefix = `${this.basketPrefix} ${ASSET_ID_VERSION} `
      for (const action of actionsResult.actions) {
        for (const output of action.outputs ?? []) {
          if (output.basket?.startsWith(basketPrefix)) {
            // Parse assetId from basket name: "btmstoken v1 <assetId>"
            const assetId = output.basket.substring(basketPrefix.length)
            if (assetId) {
              assetIds.add(assetId)
              btmsDebug(`${callId}: discovered assetId from action output basket`, { assetId, basket: output.basket })
            }
          }
        }
      }
    } catch (err) {
      btmsDebug(`${callId}: listActions FAILED`, { err })
    }

    /***************************************************************************
     * STEP B — Incoming messagebox payments (STRICT)
     ***************************************************************************/
    let incoming: any[] = []
    try {
      incoming = await this.listIncomingPayments()
      btmsDebug(`${callId}: incoming payments fetched`, {
        count: incoming.length,
        preview: incoming.slice(0, 3)
      })
    } catch (err) {
      btmsDebug(`${callId}: incoming fetch FAILED`, { err })
      incoming = []
    }

    const filteredIncoming: any[] = []

    for (const msg of incoming) {
      const hex = msg.lockingScriptHex || msg.lockingScript || msg.locking_script

      if (!hex) continue

      const decoded = this.decodeBTMSToken(hex)
      if (!decoded.valid) continue

      filteredIncoming.push(decoded)

      if (decoded.assetId) {
        assetIds.add(decoded.assetId)
        btmsDebug(`${callId}: discovered assetId from incoming message`, { id: decoded.assetId })
      }
    }

    /***************************************************************************
     * STEP C — Construct Asset models
     ***************************************************************************/
    const discoveredList = [...assetIds]
    btmsDebug(`${callId}: FINAL discovered assetIds`, discoveredList)

    const assets: Record<string, Asset> = {}
    for (const id of discoveredList) {
      assets[id] = {
        assetId: id,
        name: id,
        balance: 0,
        metadata: '',
        hasPendingIncoming: false
      }
    }

    for (const inc of filteredIncoming) {
      if (inc.assetId && assets[inc.assetId]) {
        assets[inc.assetId].hasPendingIncoming = true
        btmsDebug(`${callId}: mark pending incoming`, { assetId: inc.assetId })
      }
    }

    /***************************************************************************
     * STEP D — Compute balance
     ***************************************************************************/
    for (const id of discoveredList) {
      const bal = await this.getBalance(id)
      assets[id].balance = bal
      btmsDebug(`${callId}: balance computed`, { id, bal })
    }

    const finalList = Object.values(assets)
    btmsDebug(`${callId}: FINAL ASSET LIST`, { count: finalList.length, finalList })

    return finalList
  }

  /******************************************************************************************
   * INSTRUMENTED listIncomingPayments()
   ******************************************************************************************/
  /******************************************************************************************
   * INSTRUMENTED listIncomingPayments() — FINAL & CORRECT
   ******************************************************************************************/
  async listIncomingPayments(assetId?: string): Promise<IncomingPayment[]> {
    const callId = makeDebugCallId('listIncomingPayments')
    btmsDebug(`${callId}: START`, { filterAssetId: assetId ?? '(ALL)' })

    /***************************************************************************
     * STEP 1 — Active Identity
     ***************************************************************************/
    let myIdentityKey: string
    try {
      const { publicKey } = await this.walletClient.getPublicKey({ identityKey: true })
      myIdentityKey = publicKey
    } catch (err) {
      btmsDebug(`${callId}: getPublicKey FAILED`, { err })
      return []
    }

    btmsDebug(`${callId}: ACTIVE IDENTITY`, { myIdentityKey })

    /***************************************************************************
     * STEP 2 — Custody box name
     ***************************************************************************/
    const custodyBox = `btms-v2-custody-${myIdentityKey}`
    btmsDebug(`${callId}: CUSTODY BOX`, { custodyBox })

    /***************************************************************************
     * STEP 3 — Raw message fetch
     ***************************************************************************/
    let incoming: any[] = []
    try {
      incoming = await this.tokenator.listMessages({ messageBox: custodyBox })
    } catch (err) {
      btmsDebug(`${callId}: listMessages FAILED`, { err })
      return []
    }

    btmsDebug(`${callId}: RAW MESSAGE COUNT`, { count: incoming.length })
    btmsDebug(
      `${callId}: RAW MESSAGES`,
      incoming.map(m => ({
        messageId: m.messageId,
        sender: m.sender,
        bodyType: typeof m.body,
        bodyPreview: typeof m.body === 'string' ? m.body.slice(0, 100) : JSON.stringify(m.body).slice(0, 100)
      }))
    )

    /***************************************************************************
     * STEP 4 — Parse messages → IncomingPayment[]
     ***************************************************************************/
    const results: IncomingPayment[] = []

    for (const msg of incoming) {
      btmsDebug(`${callId}: PROCESSING MESSAGE`, { messageId: msg.messageId })

      /***** Parse JSON body safely *****/
      let parsed
      try {
        parsed = typeof msg.body === 'string' ? JSON.parse(msg.body) : msg.body
      } catch (e) {
        btmsDebug(`${callId}: PARSE ERROR`, {
          messageId: msg.messageId,
          e,
          body: msg.body
        })
        continue
      }

      if (!parsed || !parsed.token) {
        btmsDebug(`${callId}: SKIP — NO TOKEN`, { messageId: msg.messageId })
        continue
      }

      const t = parsed.token

      btmsDebug(`${callId}: TOKEN RAW`, {
        messageId: msg.messageId,
        tPreview: {
          txid: t.txid,
          vout: t.vout,
          keyID: t.keyID,
          lockingScriptPreview: (t.lockingScript || t.lockingScriptHex)?.slice?.(0, 48)
        }
      })

      /***** Support both lockingScript and lockingScriptHex *****/
      const lsHex = t.lockingScript || t.lockingScriptHex

      if (!lsHex) {
        btmsDebug(`${callId}: SKIP — NO lockingScript`, { messageId: msg.messageId })
        continue
      }

      /***** Decode the PushDrop *****/
      const decoded = this.decodeBTMSToken(lsHex)

      btmsDebug(`${callId}: DECODED TOKEN`, {
        messageId: msg.messageId,
        decoded
      })

      if (!decoded.valid) continue
      if (assetId && decoded.assetId !== assetId) continue

      /***** Normalize BEEF payload *****/
      let beefBinary: number[] | undefined

      if (t.beefPayload && Array.isArray(t.beefPayload)) {
        beefBinary = t.beefPayload
      } else if (t.beef instanceof Uint8Array) {
        beefBinary = Array.from(t.beef)
      } else {
        beefBinary = undefined
        btmsDebug(`${callId}: WARNING — no valid beefPayload/beef`, {
          messageId: msg.messageId
        })
      }

      /***** Construct normalized IncomingPayment *****/
      results.push({
        txid: t.txid,
        vout: t.vout ?? 0,
        lockingScript: lsHex,
        amount: decoded.amount,
        assetId: decoded.assetId,
        keyID: t.keyID,
        sender: msg.sender,
        messageId: msg.messageId,
        satoshis: t.satoshis,
        tx: beefBinary!
      })
    }

    btmsDebug(`${callId}: COMPLETE`, { count: results.length })
    return results
  }

  async acceptIncomingPayment(assetId: string, payment: IncomingPayment): Promise<boolean> {
    const callId = makeDebugCallId('acceptIncomingPayment')

    btmsDebug(`${callId}: START`, {
      expectedAsset: assetId,
      rawPayment: {
        txid: payment.txid,
        vout: payment.vout,
        satoshis: payment.satoshis,
        sender: payment.sender,
        keyID: payment.keyID,
        hasTx: !!(payment as any).tx,
        hasBeefPayload: (payment as any).beefPayload !== undefined,
        hasBeef: (payment as any).beef !== undefined,
        messageId: payment.messageId
      }
    })

    // ---------------------------------------------------------------------------
    // 0) Ensure identity is switched BEFORE internalization
    // ---------------------------------------------------------------------------
    await this.switchIdentityToActiveProfile()

    // ---------------------------------------------------------------------------
    // 1) Extract lockingScript
    // ---------------------------------------------------------------------------
    const scriptHex = payment.lockingScript
    if (!scriptHex) {
      btmsDebug(`${callId}: ERROR missing lockingScript`)
      return false
    }
    btmsDebug(`${callId}: lockingScript length`, { length: scriptHex.length })

    // ---------------------------------------------------------------------------
    // 2) STRICT PushDrop decoding using reusable decodeBTMSToken()
    // ---------------------------------------------------------------------------
    const decodedToken = this.decodeBTMSToken(scriptHex)

    btmsDebug(`${callId}: decodeBTMSToken result`, decodedToken)

    if (!decodedToken.valid) {
      btmsDebug(`${callId}: ERROR invalid decoded token`, { decodedToken })
      throw new Error('acceptIncomingPayment: invalid BTMS token script')
    }

    const tokenName = decodedToken.assetId
    const amountStr = String(decodedToken.amount)
    const opField = decodedToken.op
    const metadataJson = decodedToken.metadata ?? '{}'

    btmsDebug(`${callId}: STRICT FIELD ORDER`, {
      tokenName,
      opField,
      amountStr,
      metadataJson
    })

    if (opField !== 'ISSUE') {
      btmsDebug(`${callId}: ERROR opField != ISSUE`, { opField })
      throw new Error('acceptIncomingPayment: unsupported op (must be ISSUE)')
    }

    // Validate assetId from caller (UI → BTMS)
    const canonicalAssetId = tokenName

    if (assetId && canonicalAssetId !== assetId) {
      btmsDebug(`${callId}: ERROR asset mismatch`, {
        assetId,
        canonicalAssetId
      })
      return false
    }

    btmsDebug(`${callId}: canonicalAssetId OK`, { canonicalAssetId })

    // ---------------------------------------------------------------------------
    // 3) Normalize BEEF from payment.{tx, beef, beefPayload}
    // ---------------------------------------------------------------------------
    let rawBeef: any = (payment as any).tx ?? (payment as any).beef ?? (payment as any).beefPayload ?? undefined

    btmsDebug(`${callId}: rawBeef presence`, {
      type: typeof rawBeef,
      isArray: Array.isArray(rawBeef),
      size: rawBeef ? rawBeef.length : null
    })

    const beef = await this.toAtomicBeef(rawBeef, callId, 'acceptIncomingPayment/beef')

    if (!beef) {
      btmsDebug(`${callId}: toAtomicBeef FAILED`)
      return false
    }

    btmsDebug(`${callId}: atomicBeef created`, {
      beefLength: beef.length
    })

    // ---------------------------------------------------------------------------
    // 4) Parse customInstructions
    // ---------------------------------------------------------------------------
    let parsedCI: any = {}
    try {
      const rawCI = (payment as any).customInstructions
      if (rawCI !== undefined) {
        parsedCI = typeof rawCI === 'string' ? JSON.parse(rawCI) : rawCI
      }
    } catch (e) {
      btmsDebug(`${callId}: customInstructions parse FAILED`, { error: e })
    }

    btmsDebug(`${callId}: customInstructions`, { parsedCI })

    if (parsedCI.assetId && parsedCI.assetId !== canonicalAssetId) {
      btmsDebug(`${callId}: ERROR CI asset mismatch`, {
        canonicalAssetId,
        ciAssetId: parsedCI.assetId
      })
      return false
    }

    if (parsedCI.keyID && payment.keyID && parsedCI.keyID !== payment.keyID) {
      btmsDebug(`${callId}: ERROR CI keyID mismatch`, {
        ciKeyID: parsedCI.keyID,
        paymentKeyID: payment.keyID
      })
      return false
    }

    // ---------------------------------------------------------------------------
    // 5) Identity sanity-check (optional)
    // ---------------------------------------------------------------------------
    try {
      const { publicKey: myIdentityKey } = await this.walletClient.getPublicKey({
        identityKey: true
      })

      const lockingKey = (decodedToken as any).lockingPublicKey as string | undefined

      btmsDebug(`${callId}: identity check`, {
        lockingKey,
        myIdentityKey
      })

      if (lockingKey && lockingKey !== myIdentityKey) {
        btmsDebug(`${callId}: WARNING identity mismatch`, {
          lockingKey,
          myIdentityKey
        })
      }
    } catch (e) {
      btmsDebug(`${callId}: identity check skipped`, { error: e })
    }

    // ---------------------------------------------------------------------------
    // 6) Log verified token details
    // ---------------------------------------------------------------------------
    let parsedMeta: any = {}
    try {
      parsedMeta = JSON.parse(metadataJson)
    } catch {
      // ignore JSON errors
    }
    const logicalAmount = Number(amountStr)

    btmsDebug(`${callId}: verified incoming token`, {
      assetId: canonicalAssetId,
      amount: logicalAmount,
      name: parsedMeta?.name ?? 'Token',
      satoshis: payment.satoshis
    })

    // ---------------------------------------------------------------------------
    // 7) OVERLAY VERIFICATION — Check if token exists on overlay, re-submit if missing
    // ---------------------------------------------------------------------------
    const txid = payment.txid
    const vout = payment.vout

    const resolver = new LookupResolver({ networkPreset: 'local' })

    let isOnOverlay = false
    try {
      const lookupResult = await resolver.query({
        service: 'ls_btms',
        query: { txid, outputIndex: vout }
      })

      // Check if we got a valid output-list response with matching output
      if (lookupResult.type === 'output-list' && lookupResult.outputs.length > 0) {
        isOnOverlay = true
        btmsDebug(`${callId}: token found on overlay`, { txid, vout })
      } else {
        btmsDebug(`${callId}: token NOT found on overlay`, { txid, vout, lookupResult })
      }
    } catch (err) {
      btmsDebug(`${callId}: overlay lookup failed`, { txid, vout, err })
      // Continue to re-submit attempt
    }

    // If not on overlay, attempt to re-broadcast
    if (!isOnOverlay) {
      btmsDebug(`${callId}: attempting re-broadcast to overlay`, { txid, vout })

      try {
        const broadcaster = new TopicBroadcaster(['tm_btms'], { networkPreset: 'local' })
        const txObj = Transaction.fromBEEF(beef)
        const broadcastResult = await broadcaster.broadcast(txObj)

        if (broadcastResult.status === 'success') {
          btmsDebug(`${callId}: re-broadcast SUCCESS`, { txid })
          isOnOverlay = true
        } else {
          btmsDebug(`${callId}: re-broadcast FAILED`, { txid, result: broadcastResult })
          // Don't throw - we'll still try to internalize and verify later
        }
      } catch (err) {
        btmsDebug(`${callId}: re-broadcast ERROR`, { txid, err })
        // Don't throw - we'll still try to internalize and verify later
      }
    }

    // ---------------------------------------------------------------------------
    // 8) INTERNALIZE — Insert token into wallet basket
    // ---------------------------------------------------------------------------
    const basketName = `btmstoken v1 ${canonicalAssetId}` as BasketStringUnder300Bytes

    const insertArgs: InternalizeActionArgs = {
      tx: beef,
      labels: ['btms'],
      outputs: [
        {
          outputIndex: payment.vout as PositiveIntegerOrZero,
          protocol: 'basket insertion',
          insertionRemittance: {
            basket: basketName
          }
        }
      ],
      description: `Insert ${canonicalAssetId} token` as DescriptionString5to50Bytes,
      seekPermission: true
    }

    await this.walletClient.internalizeAction(insertArgs)
    // ---------------------------------------------------------
    // FIX – Mark this incoming message as CONSUMED so UI stops showing it
    // ---------------------------------------------------------
    if (payment.messageId) {
      payment.stillPending = false
    }

    // Remove from local cached incoming list, if present
    if (this._lastIncomingResult && Array.isArray(this._lastIncomingResult)) {
      this._lastIncomingResult = this._lastIncomingResult.filter(x => x.messageId !== payment.messageId)
    }

    btmsDebug(`${callId}: FIX applied – message removed from local cache`, {
      messageId: payment.messageId
    })

    // ---------------------------------------------------------------------------
    // 9) TRACE — inspect wallet outputs inside this basket (debug only)
    // ---------------------------------------------------------------------------
    try {
      const basketName = `btmstoken v1 ${canonicalAssetId}`
      btmsDebug(`${callId}: listOutputs for basket`, { basketName })

      const outputs = await this.walletClient.listOutputs({
        basket: basketName as BasketStringUnder300Bytes,
        include: 'locking scripts',
        includeTags: true,
        includeLabels: true,
        seekPermission: true,
        limit: 10000
      })

      btmsDebug(`${callId}: listOutputs result`, {
        basketName,
        total: outputs.totalOutputs,
        outputs: outputs.outputs.map(o => ({
          outpoint: o.outpoint,
          satoshis: o.satoshis,
          hasScript: !!o.lockingScript
        }))
      })
    } catch (e) {
      btmsDebug(`${callId}: ERROR during listOutputs trace`, { error: e })
    }

    // ---------------------------------------------------------------------------
    // 10) VERIFY — listAssets() confirms UTXO accessible
    // ---------------------------------------------------------------------------
    const assets = await this.listAssets('locking scripts')

    btmsDebug(`${callId}: listAssets snapshot`, {
      count: assets.length,
      assetIds: assets.map(a => a.assetId)
    })

    const match = assets.find(a => a.assetId === canonicalAssetId)

    if (!match) {
      btmsDebug(`${callId}: ERROR no matching asset in listAssets() after internalize`, {
        canonicalAssetId,
        assets
      })
      // Again: DO NOT ACK — let the user retry.
      return false
    }

    btmsDebug(`${callId}: VERIFIED asset present in listAssets`, { match })

    // ---------------------------------------------------------------------------
    // 11) ACKNOWLEDGE MESSAGE — ONLY NOW (after all checks pass)
    // ---------------------------------------------------------------------------
    if (payment.messageId) {
      btmsDebug(`${callId}: ACKNOWLEDGING messageId`, {
        messageId: payment.messageId
      })

      await this.tokenator.acknowledgeMessage({
        messageIds: [payment.messageId]
      })

      btmsDebug(`${callId}: message ACKED`, {
        messageId: payment.messageId
      })
    } else {
      btmsDebug(`${callId}: no messageId to ACK`)
    }

    // ---------------------------------------------------------------------------
    // 12) DONE
    // ---------------------------------------------------------------------------
    btmsDebug(`${callId}: COMPLETE`, {
      assetId: canonicalAssetId,
      accepted: true
    })

    return true
  }

  // ---------------------------------------------------------------
  // listIncomingPayments() — With Diagnostic Enrichment
  // ---------------------------------------------------------------

  // ----------------------------------------------------
  // Helper: safe double parse for legacy messages
  // ----------------------------------------------------
  private safeDoubleParse(s: string): any {
    try {
      const once = JSON.parse(s)
      if (typeof once === 'string') {
        return JSON.parse(once)
      }
      return once
    } catch {
      return null
    }
  }

  /**
   * Refund an incoming BTMS token back to sender.
   * (New-world createAction → signAction pattern)
   */
  async refundIncomingTransaction(assetId: string, payment: IncomingPayment): Promise<SubmitResult> {
    const callId = makeDebugCallId('refundIncomingTransaction')
    btmsDebug(`${callId}: start`, {
      assetId,
      txid: payment.txid,
      vout: payment.vout,
      sender: payment.sender
    })

    // ------------------------------------------------------------
    // 1) Decode BTMS token from lockingScript (HEX)
    // ------------------------------------------------------------
    const d = this.decodeBTMSToken(payment.lockingScript)

    if (!d.valid) {
      btmsDebug(`${callId}: decodeBTMSToken FAILED`, { lockingScript: payment.lockingScript })
      throw new Error('refundIncomingTransaction: invalid BTMS token script')
    }

    // d = { valid, assetId, amount, metadata, op }
    btmsDebug(`${callId}: decodeBTMSToken RESULT`, d)

    // STRICT v2 rules
    if (d.op !== 'ISSUE') {
      throw new Error(`refundIncomingTransaction: unsupported op "${d.op}" (must be ISSUE)`)
    }

    const logicalAmount = d.amount
    const metadataJson = d.metadata ?? '{}'

    if (!Number.isFinite(logicalAmount) || logicalAmount <= 0) {
      throw new Error('refundIncomingTransaction: logical token amount is invalid or non-positive')
    }

    // Safe-parse metadata JSON
    let parsedMetadata: { name?: string } = {}
    try {
      parsedMetadata = JSON.parse(metadataJson)
    } catch {
      // ignore, use empty object
    }

    btmsDebug(`${callId}: decoded`, {
      logicalAmount,
      metadata: parsedMetadata
    })

    // ------------------------------------------------------------
    // 2) Validate we have the prior transaction BEEF
    // ------------------------------------------------------------

    let prevTx: Transaction

    if (!payment.tx) {
      throw new Error('refundIncomingTransaction: Missing BEEF data on payment.tx.')
    }

    let prevBeef: Beef
    try {
      prevBeef = Beef.fromBinary(payment.tx as any)
      prevTx = Transaction.fromAtomicBEEF(prevBeef.toBinary())
    } catch (e) {
      btmsDebug(`${callId}: failed to parse BEEF`, { error: e })
      throw new Error('refundIncomingTransaction: Invalid prior transaction BEEF.')
    }

    const template = new BTMSToken()
    const ownerKeyID = payment.keyID
    const txForSigning = prevTx

    // ------------------------------------------------------------
    // 3) Build refund output back to original sender
    // ------------------------------------------------------------

    const refundScriptHex = (
      await template.lock(this.protocolID, ownerKeyID, payment.sender, assetId, logicalAmount, metadataJson)
    ).toHex() as HexString

    const outputs: CreateActionOutput[] = [
      {
        satoshis: payment.satoshis,
        lockingScript: refundScriptHex,
        outputDescription: `Refund ${logicalAmount} ${parsedMetadata.name ?? 'BTMS token'} to sender`,
        tags: ['btms', 'refund'] as OutputTagStringUnder300Bytes[]
      }
    ]

    btmsDebug(`${callId}: built refund outputs`, {
      outputCount: outputs.length
    })

    // ------------------------------------------------------------
    // 4) Create the action using the original tx as input
    // ------------------------------------------------------------

    const outpoint = `${payment.txid}.${payment.vout}` as OutpointString

    const { signableTransaction } = await this.walletClient.createAction({
      description: `Refund ${logicalAmount} ${parsedMetadata.name ?? 'BTMS token'} to sender`,
      labels: [assetId as LabelStringUnder300Bytes],
      inputBEEF: prevBeef.toBinary(),
      inputs: [
        {
          outpoint,
          unlockingScriptLength: 74,
          inputDescription: 'Spend incoming BTMS token for refund'
        }
      ],
      outputs,
      options: {
        acceptDelayedBroadcast: false,
        randomizeOutputs: false
      }
    } as CreateActionArgs)

    if (!signableTransaction) {
      throw new Error('refundIncomingTransaction: createAction missing signableTransaction')
    }

    // ------------------------------------------------------------
    // 5) Build unlocking script for the input using PushDrop.unlock
    // ------------------------------------------------------------

    const txToSign = Transaction.fromAtomicBEEF(signableTransaction.tx as AtomicBEEF)

    const unlocker = new PushDrop(walletClient).unlock(this.protocolID, ownerKeyID, 'self')
    const unlockingScript = await unlocker.sign(txToSign, 0)

    btmsDebug(`${callId}: built unlockingScript`, {
      length: unlockingScript.toHex().length
    })

    const signResult = await this.walletClient.signAction({
      reference: signableTransaction.reference,
      spends: {
        0: { unlockingScript: unlockingScript.toHex() }
      }
    } as SignActionArgs)

    if (!signResult.tx) {
      throw new Error('refundIncomingTransaction: signAction missing tx field')
    }

    const finalTx = Transaction.fromAtomicBEEF(signResult.tx as AtomicBEEF)
    const finalTxid = finalTx.id('hex') as TXIDHexString

    btmsDebug(`${callId}: built refund tx`, { txid: finalTxid })

    // ------------------------------------------------------------
    // 6) Broadcast via TopicBroadcaster
    // ------------------------------------------------------------

    const broadcaster = new TopicBroadcaster(['tm_btms'], {
      networkPreset: 'local'
    })

    const broadcastResult = await broadcaster.broadcast(finalTx)
    btmsDebug(`${callId}: broadcastResult`, {
      status: broadcastResult.status,
      reason: (broadcastResult as any).reason
    })

    if (broadcastResult.status !== 'success') {
      const reason = (broadcastResult as any).reason ?? 'unknown'
      throw new Error(`refundIncomingTransaction: broadcast failed: ${reason}`)
    }

    // ------------------------------------------------------------
    // 7) ACK the original peer-serv message, if present
    // ------------------------------------------------------------

    if (payment.messageId) {
      await this.tokenator.acknowledgeMessage({
        messageIds: [payment.messageId]
      })
    }

    btmsDebug(`${callId}: refund complete`, { txid: finalTxid })

    // We don't get topics from the overlay in new-world, so we keep this
    // compatible with the old SubmitResult shape.
    return {
      status: 'success',
      topics: {}
    }
  }

  async getTransactions(
    assetId: string,
    limit: number,
    offset: number
  ): Promise<{
    transactions: {
      date: string
      amount: number
      txid: string
      counterparty: WalletCounterparty
    }[]
  }> {
    const callId = makeDebugCallId('getTransactions')
    btmsDebug(`${callId}: start`, { assetId, limit, offset })

    // -------------------------------------------------------------
    // Resolve my identity key (used ONLY when inferring counterparty)
    // -------------------------------------------------------------
    const { publicKey: myIdentityKey } = await this.walletClient.getPublicKey({
      identityKey: true
    })

    // -------------------------------------------------------------
    // listActions – new-world compatible call
    // -------------------------------------------------------------
    const actions = await this.walletClient.listActions({
      labels: [assetId.replace('.', ' ')],
      limit,
      offset
    })

    // -------------------------------------------------------------
    // actions.actions is the correct list
    // -------------------------------------------------------------
    const txs = actions.actions.map(a => {
      // -----------------------------------------------------------
      // NEW-WORLD RULE:
      //   • No per-input tags
      //   • No PushDrop decode on inputs
      //   • No owner fields
      //
      // Amount must be inferred from:
      //   a.isOutgoing ? (negative) : (positive)
      //   and the token quantity we issued/redeemed.
      //
      // For BTMS: each action corresponds to exactly one transfer.
      // -----------------------------------------------------------

      let quantity = 0

      // -----------------------------------------------------------
      // Decode BTMS quantity from ANY output that contains a BTMS script
      // -----------------------------------------------------------
      const outputs = a.outputs ?? []
      for (const output of outputs) {
        const scriptSource = (output as any).lockingScript ?? (output as any).outputScript ?? null

        if (!scriptSource) continue

        const scriptHex = this.toLockingScriptHex(scriptSource, callId, 'getTransactions/outputs')
        if (!scriptHex) continue

        let decoded
        try {
          decoded = PushDrop.decode(LockingScript.fromHex(scriptHex))
        } catch {
          continue // not a BTMS script
        }

        const fields = decoded.fields.map(f => Utils.toUTF8(f))
        if (fields.length < 2) continue

        const qty = Number(fields[1])
        if (!Number.isFinite(qty)) continue

        quantity = qty
        break // one BTMS field per tx
      }

      // If we could not decode, we record 0
      const amount = a.isOutgoing ? -quantity : quantity

      // -----------------------------------------------------------
      // Counterparty:
      //   • If outgoing → unknown-recipient
      //   • If incoming → myself (wallet UI convention)
      // -----------------------------------------------------------
      const counterparty: WalletCounterparty = a.isOutgoing
        ? ('unknown-recipient' as WalletCounterparty)
        : (myIdentityKey as WalletCounterparty)

      return {
        // No timestamp/created_at available → synthetic
        date: new Date().toISOString(),
        amount,
        txid: a.txid,
        counterparty
      }
    })

    return {
      ...actions,
      transactions: txs
    }
  }

  /**
   * Cross-verify incoming token message against overlay content.
   *
   * @returns { verified: boolean, reason?: string }
   */
  /**
   * Cross-verify an incoming BTMS token against the LARS overlay.
   *
   * Uses new-world LookupResolver correctly:
   *   const resolver = new LookupResolver("ls_btms");
   *   const result = await resolver.search({ txid, vout });
   */
  private verifyIncomingToken(
    scriptHex: string,
    expectedAssetId: string,
    payment: IncomingPayment
  ): { assetId: string; amount: number; metadata: string } {
    const callId = makeDebugCallId('verifyIncomingToken')

    // ------------------------------------------------------------
    // 1) Extract the PushDrop segment from wrapped lockingScript
    // ------------------------------------------------------------
    let purePushdropHex: string

    try {
      const asm = LockingScript.fromHex(scriptHex).toASM().split(' ')
      const idx = asm.indexOf('OP_0') // first PushDrop marker

      if (idx === -1) {
        throw new Error('PushDrop segment not found')
      }

      const pushdropAsm = asm.slice(idx).join(' ')
      purePushdropHex = LockingScript.fromASM(pushdropAsm).toHex()

      btmsDebug(`${callId}: extracted PushDrop`, {
        idx,
        pushdropAsmPreview: pushdropAsm.slice(0, 120) + '...',
        purePushdropHexPreview: purePushdropHex.slice(0, 120) + '...'
      })
    } catch (e) {
      btmsDebug(`${callId}: extract FAILED`, { error: e })
      throw new Error('verifyIncomingToken: cannot isolate PushDrop segment')
    }

    // ------------------------------------------------------------
    // 2) Canonical BTMS v2 decode
    // ------------------------------------------------------------
    const d = this.decodeBTMSToken(purePushdropHex)

    btmsDebug(`${callId}: decodeBTMSToken result`, d)

    if (!d.valid) {
      throw new Error('verifyIncomingToken: invalid BTMS token script')
    }

    // ------------------------------------------------------------
    // 3) Strict v2 validation
    // ------------------------------------------------------------
    if (d.op !== 'ISSUE') {
      throw new Error(`verifyIncomingToken: unsupported op "${d.op}"`)
    }

    if (!Number.isFinite(d.amount) || d.amount <= 0) {
      throw new Error(`verifyIncomingToken: invalid amount "${d.amount}"`)
    }

    if (typeof d.metadata !== 'string') {
      throw new Error('verifyIncomingToken: metadata must be JSON string')
    }

    // ------------------------------------------------------------
    // 4) Asset validation
    // ------------------------------------------------------------
    const assetId = d.assetId

    if (assetId !== expectedAssetId) {
      throw new Error(`verifyIncomingToken: asset mismatch. Expected ${expectedAssetId}, got ${assetId}`)
    }

    // ------------------------------------------------------------
    // 5) Return normalized structure
    // ------------------------------------------------------------
    return {
      assetId,
      amount: d.amount,
      metadata: d.metadata
    }
  }

  // async proveOwnership(assetId: string, amount: number, verifier: string): Promise<OwnershipProof> {
  //   // Get a list of tokens
  //   const myTokens = await this.getTokens(assetId, true)
  //   let amountProven = 0
  //   const provenTokens: {
  //     output: GetTransactionOutputResult;
  //     linkage: SpecificKeyLinkageResult;
  //   }[] = []
  //   const myIdentityKey = await getPublicKey({ identityKey: true })
  //   // Go through the list
  //   for (const token of myTokens) {
  //     // Obtain key linkage for each token
  //     const parsedInstructions = JSON.parse(token.customInstructions as string)
  //     const linkage = await revealKeyLinkage({ // TODO: signing strategy
  //       mode: 'specific',
  //       counterparty: this.getCounterpartyFromInstructions(parsedInstructions),
  //       protocolID: this.protocolID,
  //       keyID: this.getKeyIDFromInstructions(parsedInstructions),
  //       verifier,
  //       description: 'Prove token ownership'
  //     })
  //     provenTokens.push({
  //       output: token,
  //       linkage: linkage as SpecificKeyLinkageResult
  //     })
  //     // Increment the amount counter each time
  //     const t = pushdrop.decode({
  //       script: token.outputScript,
  //       fieldFormat: 'utf8'
  //     })
  //     amountProven += Number(t.fields[1])
  //     // Break if the amount counter goes above the amount to prove
  //     if (amountProven > amount) break
  //   }
  //   // After the loop check the counter
  //   // Error if we have not proven the full amount
  //   if (amountProven < amount) {
  //     throw new Error('User does not have amount of asset requested for ownership oroof.')
  //   }
  //   // Return the proof
  //   return {
  //     prover: myIdentityKey,
  //     verifier,
  //     tokens: provenTokens,
  //     amount,
  //     assetId
  //   }
  // }

  // async verifyOwnership(proof: OwnershipProof, useAnyoneKey = false): Promise<boolean> {
  //   // Keep count of amount proven
  //   let amountProven = 0
  //   // Go through all tokens
  //   for (const token of proof.tokens) {
  //     // Increment the amount counter each time
  //     const t = pushdrop.decode({
  //       script: token.output.outputScript,
  //       fieldFormat: 'utf8'
  //     })
  //     amountProven += Number(t.fields[1])
  //     // Ensure token linkage is verified for prover
  //     const valid = await this.verifyLinkageForProver(token.linkage, t.lockingPublicKey, useAnyoneKey)
  //     if (!valid) {
  //       throw new Error('Invalid key linkage for token prover.')
  //     }
  //     // Ensure the proof belongs to the prover
  //     if (token.linkage.prover !== proof.prover) {
  //       throw new Error('Prover tried to prove tokens that were not theirs.')
  //     }
  //     // Ensure token is on overlay
  //     const resultFromOverlay = await this.findFromTokenOverlay({
  //       txid: token.output.txid,
  //       vout: token.output.vout
  //     })
  //     if (resultFromOverlay.length < 1) {
  //       throw new Error('Claimed token is not on the overlay.')
  //     }
  //   }
  //   // Check amount in proof against total
  //   // Error if amounts mismatch
  //   if (amountProven !== proof.amount) {
  //     throw new Error('Amount of tokens in proof not as claimed.')
  //   }
  //   // Return true as proof is valid
  //   return true
  // }

  // /**
  //  * Checks that an asset ID is in the correct format
  //  * @param assetId Asset ID to validate
  //  * @returns a boolean indicating asset ID validity
  //  */
  // validateAssetId(assetId: string): boolean {
  //   if (typeof assetId !== 'string') {
  //     return false
  //   }
  //   const [first, second, third] = assetId.split('.')
  //   if (typeof first !== 'string' || typeof second !== 'string') {
  //     return false
  //   }
  //   if (typeof third !== 'undefined') {
  //     return false
  //   }
  //   if (!/^[0-9a-fA-F]{64}$/.test(first)) {
  //     return false
  //   }
  //   const secondNum = Number(second)
  //   if (!Number.isInteger(secondNum)) {
  //     return false
  //   }
  //   if (secondNum < 0) {
  //     return false
  //   }
  //   return true
  // }

  // /**
  //  * Lists an asset on the marketplace for sale
  //  * @param assetId The ID of the asset to list
  //  * @param amount The amount you want to sell
  //  * @param desiredAssets Assets you would desire to have in return so people can make you an offer
  //  * @param description Marketplace listing description
  //  * @returns Overlay network submission results
  //  */
  // async listAssetForSale(
  //   assetId: string,
  //   amount: number,
  //   desiredAssets: Record<string, number>,
  //   description?: string
  // ): Promise<SubmitResult> {
  //   // Validate desired assets
  //   for (const key of Object.keys(desiredAssets)) {
  //     const validAssetId = this.validateAssetId(key)
  //     if (!validAssetId) {
  //       const e = new Error('Assset ID in desired assets structure invalid')
  //       console.error('Rejecting output for having an invalid asset ID in desired assets')
  //       throw e
  //     }
  //   }
  //   for (const val of Object.values(desiredAssets)) {
  //     if (typeof val !== 'number' || val < -1 || !Number.isInteger(val)) {
  //       const e = new Error('Amount in desired assets structure invalid')
  //       console.error('Rejecting output for having an invalid amount in desired assets')
  //       throw e
  //     }
  //   }

  //   // Creat a proof
  //   const anyonePub = new PrivateKey(ANYONE, 'hex').toPublicKey().toString()
  //   const proof = await this.proveOwnership(assetId, amount, anyonePub)
  //   // Compose a PushDrop token
  //   // const token = await pushdrop.create({
  //   //   fields: [
  //   //     Buffer.from(JSON.stringify(proof), 'utf8'),
  //   //     Buffer.from(JSON.stringify(desiredAssets), 'utf8'),
  //   //     Buffer.from(description || '', 'utf8')
  //   //   ],
  //   //   protocolID: [2, 'marketplace'],
  //   //   keyID: '1',
  //   //   counterparty: 'anyone',
  //   //   ownedByCreator: true
  //   // })

  //   const identityKey = await getPublicKey({ identityKey: true })

  //   // Here's the part where we create the new Bitcoin token.
  //   // This uses a library called PushDrop, which lets you attach data
  //   // payloads to Bitcoin token outputs. Then, you can redeem / unlock the
  //   // tokens later.
  //   const token = await pushdrop.create({
  //     fields: [ // The "fields" are the data payload to attach to the token.
  //       Buffer.from(JSON.stringify(proof), 'utf8'),
  //       Buffer.from(identityKey, 'hex'),
  //       Buffer.from(JSON.stringify(desiredAssets), 'utf8'),
  //       Buffer.from(description || '', 'utf8')
  //     ],
  //     // The same "postboard" protocol and key ID can be used to sign and
  //     // lock this new Bitcoin PushDrop token.
  //     protocolID: 'marketplace',
  //     keyID: '1',
  //     counterparty: 'anyone',
  //     ownedByCreator: true
  //   })

  //   debugger

  //   // Create a transaction
  //   const action = await createAction({
  //     description: 'List assets on the marketplace',
  //     outputs: [{
  //       satoshis: this.satoshis,
  //       script: token
  //     }]
  //   })

  //   const parsedTransaction = new bsv.Transaction(action.rawTx)
  //   const output = parsedTransaction.outputs[0]

  //   const parsedToken = pushdrop.decode({
  //     script: output.script.toHex(),
  //     fieldFormat: 'buffer'
  //   })
  //   const parsedProof = JSON.parse(parsedToken.fields[0].toString('utf8'))

  //   const expected = getPaymentAddress({
  //     senderPrivateKey: '0000000000000000000000000000000000000000000000000000000000000001',
  //     recipientPublicKey: parsedToken.fields[1].toString('hex'),
  //     invoiceNumber: '2-marketplace-1',
  //     returnType: 'publicKey'
  //   })
  //   // // Ensure result.lockingPublicKey came from prover
  //   // const expected = getPaymentAddress({
  //   //   senderPrivateKey: ANYONE,
  //   //   recipientPublicKey: parsedProof.prover,
  //   //   invoiceNumber: '2-marketplace-1',
  //   //   returnType: 'publicKey'
  //   // })
  //   console.log('claimed key', parsedToken.fields[1].toString('hex'))
  //   console.log('expected child', expected)
  //   console.log('actual child', parsedToken.lockingPublicKey)
  //   if (expected !== parsedToken.lockingPublicKey) {
  //     const e = new Error('Unable to verify identity public key links to signing key')
  //     console.error('Rejecting output for ownership proof mismatch')
  //     throw e
  //   }

  //   // Send the transaction to the oerlay
  //   return await this.submitToMarketplaceOverlay(action)
  // }

  // /**
  //  * Returns an array of all marketplace entries
  //  * @returns An array of all marketplace entries
  //  */
  // async findAllAssetsForSale(findMine = false): Promise<MarketplaceEntry[]> {
  //   const findParams: { seller?: string, findAll?: boolean } = {}
  //   if (findMine) {
  //     const myIdentity = await getPublicKey({ identityKey: true })
  //     findParams.seller = myIdentity
  //   } else {
  //     findParams.findAll = true
  //   }
  //   const assets = await this.findFromMarketplaceOverlay(findParams)
  //   const results: MarketplaceEntry[] = []
  //   for (const asset of assets) {
  //     const decoded = pushdrop.decode({
  //       script: asset.outputScript,
  //       returnType: 'buffer'
  //     })
  //     const parsedProof: OwnershipProof = JSON.parse(decoded.fields[0].toString('utf8'))
  //     const parsedDesiredAssets = JSON.parse(decoded.fields[1].toString('utf8'))
  //     const decodedAsset = pushdrop.redeem({
  //       script: parsedProof.tokens[0].output.outputScript,
  //       returnType: 'utf8'
  //     })
  //     results.push({
  //       seller: parsedProof.prover,
  //       amount: parsedProof.amount,
  //       description: decoded.fields[2] ? decoded.fields[2].toString('utf8') : '',
  //       desiredAssets: parsedDesiredAssets,
  //       ownershipProof: parsedProof,
  //       assetId: parsedProof.assetId,
  //       metadata: decodedAsset.fields[2].toString('utf8')
  //     })
  //   }
  //   return results
  // }

  // async makeOffer(entry: MarketplaceEntry, assetId: string, amount: number): Promise<void> {
  //   // Verify the assets are still available
  //   const verified = await this.verifyOwnership(entry.ownershipProof, true)
  //   if (!verified) {
  //     throw new Error('Item is no longer for sale.')
  //   }

  //   // Compose a proof of our assets for the seller
  //   const buyerProof = await this.proveOwnership(assetId, amount, entry.seller)

  //   // prepare a funding UTXO for the trade offer
  //   const fundingKeyID = this.getRandomKeyID()
  //   const fundingTemplate = new BTMSFundingToken()
  //   const fundingScript = await fundingTemplate.lock(this.protocolID, fundingKeyID, entry.seller)
  //   const buyerOfferCustomInstructions: BuyerOfferCustomInstructions = {
  //     buyerProof,
  //     buyerOfferedAssetId: assetId,
  //     buyerOfferedAmount: amount,
  //     sellerEntry: entry,
  //     fundingKeyID
  //   }
  //   const fundingAction = await createAction({
  //     outputs: [{
  //       satoshis: 1000,
  //       script: fundingScript.toHex(),
  //       description: 'Fund a trade offer',
  //       basket: `${this.basket} trades`,
  //       customInstructions: JSON.stringify(buyerOfferCustomInstructions)
  //     }],
  //     description: 'Offer a trade'
  //   })

  //   // Extract buyer's asset metadata to forward in the new UTXO
  //   const decodedBuyerAsset = pushdrop.redeem({
  //     script: buyerProof.tokens[0].output.outputScript,
  //     returnType: 'utf8'
  //   })
  //   const metadata = decodedBuyerAsset.fields[2].toString('utf8')

  //   // Create scripts for both the buyer's and seller's new ownership
  //   const desiredBuyerKeyID = this.getRandomKeyID()
  //   const template = new BTMSToken()
  //   const desiredBuyerScript = (await template.lock(this.protocolID, desiredBuyerKeyID, entry.seller, assetId, entry.amount, metadata, true)).toHex()
  //   const desiredSellerKeyID = this.getRandomKeyID()
  //   const desiredSellerScript = (await template.lock(this.protocolID, desiredSellerKeyID, entry.seller, assetId, amount, metadata)).toHex()

  //   // Create a conditionally signed transaction paying the seller's assets to us
  //   const tx = new Transaction()

  //   // Add outputs
  //   tx.addOutput({
  //     lockingScript: LockingScript.fromHex(desiredBuyerScript),
  //     satoshis: this.satoshis
  //   })
  //   tx.addOutput({
  //     lockingScript: LockingScript.fromHex(desiredSellerScript),
  //     satoshis: this.satoshis
  //   })
  //   // TODO: Buyer and seller may both want change. Currently this is not implemented

  //   // Go through all seller inputs and add them to the list
  //   for (let i = 0; i < entry.ownershipProof.tokens.length; i++) {
  //     tx.addInput({
  //       sourceTransaction: Transaction.fromHex(entry.ownershipProof.tokens[i].output.envelope?.rawTx as string),
  //       sourceOutputIndex: entry.ownershipProof.tokens[i].output.vout,
  //       sequence: 0xffffffff
  //     })
  //   }

  //   // Add the funding input
  //   tx.addInput({
  //     sourceTransaction: Transaction.fromHex(fundingAction.rawTx as string),
  //     sourceOutputIndex: 0,
  //     sequence: 0xffffffff,
  //     unlockingScriptTemplate: fundingTemplate.unlock(this.protocolID, fundingKeyID, entry.seller)
  //   })

  //   // Go through all buyer inputs and sign them conditionally
  //   for (let i = 0; i < buyerProof.tokens.length; i++) {
  //     const token = buyerProof.tokens[i]
  //     const parsedInstructions = JSON.parse(token.output.customInstructions as string)
  //     const keyID = this.getKeyIDFromInstructions(parsedInstructions)
  //     const counterparty = this.getCounterpartyFromInstructions(parsedInstructions)
  //     tx.addInput({
  //       sourceTransaction: Transaction.fromHex(token.output.envelope?.rawTx as string),
  //       sourceOutputIndex: token.output.vout,
  //       sequence: 0xffffffff,
  //       unlockingScriptTemplate: template.unlock(this.protocolID, keyID, counterparty)
  //     })
  //   }

  //   // sign the transacton
  //   await tx.sign()

  //   // Send the proof to the seller as an offer
  //   const partialTX = tx.toHex()

  //   const offer: MarketplaceOffer = {
  //     buyerPartialTX: partialTX,
  //     buyerProof,
  //     buyerOffersAssetId: assetId,
  //     buyerOffersAmount: amount,
  //     sellerEntry: entry,
  //     buyerFundingEnvelope: fundingAction,
  //     fundingKeyID,
  //     desiredSellerKeyID,
  //     desiredSellerChangeKeyID: undefined,
  //     desiredBuyerKeyID,
  //     desiredBuyerChangeKeyID: undefined
  //   }

  //   await this.tokenator.sendMessage({
  //     recipient: entry.seller,
  //     messageBox: this.marketplaceMessageBox,
  //     body: JSON.stringify(offer)
  //   })
  // }

  // // List outgoing offers
  // // TODO: support forAsset using output tags
  // async listOutgoingOffers(): Promise<MarketplaceOffer[]> {
  //   const basketEntries = await getTransactionOutputs({
  //     basket: `${this.basket} trades`,
  //     spendable: true,
  //     includeEnvelope: true,
  //     includeCustomInstructions: true
  //   })
  //   const rejectionMessages = await this.tokenator.listMessages({
  //     messageBox: `${this.marketplaceMessageBox}_rejection`
  //   })
  //   const results: MarketplaceOffer[] = []
  //   for (let i = 0; i < basketEntries.length; i++) {
  //     const parsedInstructions: BuyerOfferCustomInstructions = JSON.parse(basketEntries[i].customInstructions as string)
  //     // Check if the offer is rejected
  //     const rejected = rejectionMessages.some(x => x.sender === parsedInstructions.sellerEntry.seller && x.body === basketEntries[i].txid)
  //     results.push({
  //       buyerFundingEnvelope: verifyTruthy(basketEntries[i].envelope),
  //       buyerOffersAssetId: parsedInstructions.buyerOfferedAssetId,
  //       buyerOffersAmount: parsedInstructions.buyerOfferedAmount,
  //       buyerProof: parsedInstructions.buyerProof,
  //       buyerPartialTX: '', // The TX could not have been stored in custom instructions.
  //       // HOwever, the buyer does not need the TX to cancel the offer.
  //       // The buyer would just need to spend the funding UTXO.
  //       sellerEntry: parsedInstructions.sellerEntry,
  //       fundingKeyID: parsedInstructions.fundingKeyID,
  //       rejected
  //     })
  //   }
  //   return results
  // }

  // // cancel outgoing offer
  // async cancelOutgoingOffer(offer: MarketplaceOffer): Promise<void> {
  //   // Compute an unlocking script
  //   const fundingTX = Transaction.fromHex(offer.buyerFundingEnvelope.rawTx as string)
  //   const fundingTXID = offer.buyerFundingEnvelope.txid || fundingTX.id('hex') as string
  //   const signatureScope = TransactionSignature.SIGHASH_FORKID | TransactionSignature.SIGHASH_NONE | TransactionSignature.SIGHASH_ANYONECANPAY
  //   const preimage = TransactionSignature.format({
  //     sourceTXID: fundingTXID,
  //     sourceOutputIndex: 0,
  //     sourceSatoshis: fundingTX.outputs[0].satoshis as number,
  //     transactionVersion: 1,
  //     otherInputs: [],
  //     inputIndex: 0,
  //     outputs: [],
  //     inputSequence: 0xffffffff,
  //     subscript: fundingTX.outputs[0].lockingScript,
  //     lockTime: 0,
  //     scope: signatureScope
  //   })
  //   const preimageHash = Hash.sha256(preimage)
  //   const SDKSignature = await createSignature({
  //     data: Uint8Array.from(preimageHash),
  //     protocolID: this.protocolID,
  //     keyID: offer.fundingKeyID,
  //     counterparty: offer.sellerEntry.seller
  //   })
  //   const rawSignature = Signature.fromDER([...SDKSignature])
  //   const sig = new TransactionSignature(
  //     rawSignature.r,
  //     rawSignature.s,
  //     signatureScope
  //   )
  //   const sigForScript = sig.toChecksigFormat()
  //   const publicKeyString = await getPublicKey({
  //     protocolID: this.protocolID,
  //     keyID: offer.fundingKeyID,
  //     counterparty: offer.sellerEntry.seller,
  //     forSelf: true
  //   })
  //   const unlockingScript = new UnlockingScript([
  //     { op: sigForScript.length, data: sigForScript },
  //     { op: publicKeyString.length / 2, data: Utils.toArray(publicKeyString, 'hex') }
  //   ]).toHex()

  //   // Spend the offer's funding input in a transaction
  //   await createAction({
  //     description: 'cancel an offer',
  //     inputs: {
  //       [fundingTXID]: {
  //         ...verifyTruthy(offer.buyerFundingEnvelope),
  //         rawTx: offer.buyerFundingEnvelope.rawTx as string,
  //         outputsToRedeem: [{
  //           index: 0,
  //           unlockingScript
  //         }]
  //       }
  //     }
  //   })
  // }

  // async listIncomingOffers(forEntry?: MarketplaceEntry): Promise<MarketplaceOffer[]> {
  //   const offerMessages = await this.tokenator.listMessages({
  //     messageBox: this.marketplaceMessageBox
  //   })
  //   const results: MarketplaceOffer[] = []
  //   let forEntryString: string | undefined
  //   if (typeof forEntry !== 'undefined') {
  //     forEntryString = stringify(forEntry)
  //   }
  //   const myEntries = await this.findAllAssetsForSale(true)
  //   const myEntriesStrings: string[] = myEntries.map(x => stringify(x))
  //   for (let i = 0; i < offerMessages.length; i++) {
  //     try {
  //       const parsedOffer: MarketplaceOffer = JSON.parse(offerMessages[i].body)
  //       const sellerEntryString = stringify(parsedOffer.sellerEntry)
  //       if (!myEntriesStrings.some(x => x === sellerEntryString)) {
  //         continue
  //       }
  //       if (forEntryString && sellerEntryString !== forEntryString) {
  //         continue
  //       }
  //       const verified = await this.verifyOwnership(parsedOffer.buyerProof)
  //       if (!verified) {
  //         continue
  //       }
  //       if (parsedOffer.buyerProof.assetId !== parsedOffer.buyerOffersAssetId || parsedOffer.buyerProof.amount !== parsedOffer.buyerOffersAmount) {
  //         continue
  //       }
  //       // TODO: Ensure inputs and outputs are correct from both proofs, including asset IDs and amounts
  //       const isAsDesiredBySeller = parsedOffer.buyerOffersAmount >= parsedOffer.sellerEntry.desiredAssets[parsedOffer.buyerOffersAssetId]
  //       parsedOffer.isAsDesiredBySeller = isAsDesiredBySeller
  //       results.push(parsedOffer)
  //     } catch (e) {
  //       continue
  //     }
  //   }
  //   return results
  // }

  // // accept incoming offer
  // async acceptOffer(offer: MarketplaceOffer): Promise<void> {
  //   const verified = await this.verifyOwnership(offer.buyerProof)
  //   if (!verified) {
  //     throw new Error('The offer has been recinded by the buyer.')
  //   }
  //   const tx = Transaction.fromHex(offer.buyerPartialTX)
  //   const template = new BTMSToken()
  //   for (let i = 0; i < offer.sellerEntry.ownershipProof.tokens.length; i++) {
  //     const token = offer.sellerEntry.ownershipProof.tokens[i]
  //     // Ensure input exists
  //     const inputIndex = tx.inputs.findIndex(x => x.sourceTXID === token.output.txid && x.sourceOutputIndex === token.output.vout)
  //     if (inputIndex === -1) {
  //       throw new Error('Buyer did not include a required seller output')
  //     }
  //     tx.inputs[inputIndex].unlockingScriptTemplate = template.unlock(
  //       this.protocolID,
  //       this.getKeyIDFromInstructions(token.output.customInstructions),
  //       this.getCounterpartyFromInstructions(token.output.customInstructions)
  //     )
  //   }
  //   await tx.sign()
  //   const finalTX = tx.toHex()
  //   // Assemble inputs and SPV envelope
  //   const inputs: Record<string, EnvelopeApi> = {}
  //   const fundingTXID =
  //     (typeof offer.buyerFundingEnvelope.txid === 'string' && offer.buyerFundingEnvelope.txid !== '')
  //       ? offer.buyerFundingEnvelope.txid
  //       : Transaction.fromHex(offer.buyerFundingEnvelope.rawTx as string).id('hex')
  //   inputs[fundingTXID] = {
  //     ...offer.buyerFundingEnvelope,
  //     rawTx: offer.buyerFundingEnvelope.rawTx as string
  //   }
  //   for (let i = 0; i < offer.sellerEntry.ownershipProof.tokens.length; i++) {
  //     const token = offer.sellerEntry.ownershipProof.tokens[i]
  //     if (typeof inputs[token.output.txid] === 'undefined') {
  //       inputs[token.output.txid] = token.output.envelope as EnvelopeApi
  //     }
  //   }
  //   for (let i = 0; i < offer.buyerProof.tokens.length; i++) {
  //     const token = offer.buyerProof.tokens[i]
  //     if (typeof inputs[token.output.txid] === 'undefined') {
  //       inputs[token.output.txid] = token.output.envelope as EnvelopeApi
  //     }
  //   }
  //   const action: CreateActionResult = {
  //     inputs,
  //     rawTx: finalTX,
  //     mapiResponses: [],
  //     txid: tx.id('hex')
  //   }
  //   // Submit action to overlay
  //   await this.submitToTokenOverlay(action)
  //   // Submit action to seller (self) with submitDirectTransaction
  //   await submitDirectTransaction({ // TODO: signing strategy
  //     senderIdentityKey: offer.buyerProof.prover,
  //     note: `Receive ${offer.buyerOffersAmount} ${offer.buyerProof.assetId} from trade with ${offer.buyerProof.prover} in exchange for sending them my ${offer.sellerEntry.amount} ${offer.sellerEntry.assetId}`,
  //     amount: this.satoshis,
  //     labels: [offer.buyerProof.assetId.replace('.', ' ')],
  //     transaction: {
  //       ...action,
  //       rawTx: action.rawTx as string,
  //       outputs: [{
  //         vout: 1, // TODO: Verify this!
  //         basket: this.basket,
  //         satoshis: this.satoshis,
  //         tags: ['owner self'],
  //         customInstructions: JSON.stringify({
  //           sender: offer.buyerProof.prover,
  //           keyID: offer.desiredSellerKeyID !== 'undefined' && offer.desiredSellerKeyID !== '' ? offer.desiredSellerKeyID : '1'
  //         })
  //       }]
  //     }
  //   })
  //   // Submit action to buyer with tokenator
  //   await this.tokenator.sendMessage({
  //     messageBox: `${this.marketplaceMessageBox}_acceptance`,
  //     recipient: offer.buyerProof.prover,
  //     body: JSON.stringify({ offer, action })
  //   })
  // }

  // async acknowledgeNewlyAcquiredMarketplaceAssets(): Promise<void> {
  //   // List newly acquired assets sent from sellers
  //   const newAssets = await this.tokenator.listMessages({
  //     messageBox: `${this.marketplaceMessageBox}_acceptance`
  //   })
  //   for (let i = 0; i < newAssets.length; i++) {
  //     try {
  //       const parsedAsset: { action: CreateActionResult, offer: MarketplaceOffer } = JSON.parse(newAssets[i].body)
  //       // Auto-process them with submitDirectTransaction
  //       await submitDirectTransaction({ // TODO: signing strategy
  //         senderIdentityKey: newAssets[i].sender,
  //         note: `Receive ${parsedAsset.offer.sellerEntry.amount} ${parsedAsset.offer.sellerEntry.assetId} from trade with ${parsedAsset.offer.sellerEntry.seller} in exchange for sending them my ${parsedAsset.offer.buyerOffersAmount} ${parsedAsset.offer.buyerOffersAssetId}`,
  //         amount: this.satoshis,
  //         labels: [parsedAsset.offer.sellerEntry.assetId.replace('.', ' ')],
  //         transaction: {
  //           ...parsedAsset.action,
  //           rawTx: parsedAsset.action.rawTx as string,
  //           outputs: [{
  //             vout: 0, // TODO: Verify this!
  //             basket: this.basket,
  //             satoshis: this.satoshis,
  //             tags: ['owner self'],
  //             customInstructions: JSON.stringify({
  //               sender: parsedAsset.offer.sellerEntry.seller,
  //               keyID: parsedAsset.offer.desiredBuyerKeyID || '1'
  //             })
  //           }]
  //         }
  //       })
  //     } catch (e) {
  //       continue
  //     } finally {
  //       // acknowledge
  //       await this.tokenator.acknowledgeMessages({
  //         messageIds: [newAssets[i].messageId]
  //       })
  //     }
  //   }
  // }

  // // reject incoming offer
  // async rejectOffer(offer: MarketplaceOffer): Promise<void> {
  //   await this.tokenator.acknowledgeMessages({
  //     messageIds: [offer.messageId as string]
  //   })
  //   const fundingTXID = offer.buyerFundingEnvelope.txid as string ? (offer.buyerFundingEnvelope.txid || Transaction.fromHex(offer.buyerFundingEnvelope.rawTx as string).id('hex') as string) : ''
  //   await this.tokenator.sendMessage({
  //     messageBox: `${this.marketplaceMessageBox}_reject`,
  //     recipient: offer.buyerProof.prover,
  //     body: fundingTXID
  //   })
  // }

  // // reject incoming offer
  // async acknowledgeRejection(offer: MarketplaceOffer): Promise<void> {
  //   if (offer.rejected !== true) {
  //     throw new Error('This offer was never rejected.')
  //   }
  //   await this.tokenator.acknowledgeMessages({
  //     messageIds: [offer.messageId as string]
  //   })
  //   await this.cancelOutgoingOffer(offer)
  // }

  // private async verifyLinkageForProver(linkage: SpecificKeyLinkageResult, expectedKey: string, useAnyoneKey = false): Promise<boolean> {
  //   // Decrypt the linkage
  //   let decryptedLinkage: Uint8Array
  //   if (this.privateKey || useAnyoneKey) {
  //     // derive the decryption key
  //     const derivedKey = getPaymentPrivateKey({
  //       recipientPrivateKey: useAnyoneKey ? ANYONE : this.privateKey,
  //       senderPublicKey: linkage.prover,
  //       invoiceNumber: `${linkage.protocolID[0]}-${linkage.protocolID[1]}-${(linkage as unknown as { keyID: string }).keyID}`,
  //       returnType: 'hex'
  //     })
  //     const derivedCryptoKey = await crypto.subtle.importKey(
  //       'raw',
  //       Uint8Array.from(Buffer.from(derivedKey, 'hex')),
  //       { name: 'AES-GCM' },
  //       false,
  //       ['decrypt']
  //     )
  //     // decrypt the value
  //     decryptedLinkage = CWIDecrypt(linkage.encryptedLinkage, derivedCryptoKey, 'string')
  //     console.log('Decrypted linkage', decryptedLinkage)
  //   } else {
  //     decryptedLinkage = await SDKDecrypt({
  //       ciphertext: linkage.encryptedLinkage,
  //       counterparty: linkage.prover,
  //       protocolID: [2, `specific linkage revelation ${linkage.protocolID[0]} ${linkage.protocolID[1]}`],
  //       keyID: (linkage as unknown as { keyID: string }).keyID, // !!! ERRPR im base type, it DOES have keyID
  //       returnType: 'Uint8Array'
  //     }) as Uint8Array
  //   }
  //   // Add it to the prover's identity key with point addition
  //   const curve = new Curve()
  //   const linkagePoint = curve.g.mul(
  //     new BigNumber([...new Uint8Array(decryptedLinkage as Uint8Array)])
  //   )
  //   const identityKey = PublicKey.fromString(linkage.prover)
  //   const actualDerivedPoint = identityKey.add(linkagePoint)
  //   const actualDerivedKey = new PublicKey(actualDerivedPoint).toString()
  //   // Check the result against the expected key
  //   if (expectedKey === actualDerivedKey) {
  //     return true
  //   }
  //   return false
  // }

  // private async findFromTokenOverlay(token: { txid: string, vout: number }): Promise<OverlaySearchResult[]> {
  //   const result = await this.authrite.request(`${this.confederacyHost}/lookup`, {
  //     method: 'post',
  //     headers: {
  //       'Content-Type': 'application/json'
  //     },
  //     body: JSON.stringify({
  //       provider: 'tokens',
  //       query: {
  //         txid: token.txid,
  //         vout: token.vout
  //       }
  //     })
  //   })

  //   const json = await result.json()
  //   return json
  // }

  // private async findFromMarketplaceOverlay(token: {
  //   txid?: string,
  //   vout?: number,
  //   findAll?: boolean,
  //   assetId?: string,
  //   seller?: string
  // }): Promise<OverlaySearchResult[]> {
  //   const result = await this.authrite.request(`${this.confederacyHost}/lookup`, {
  //     method: 'post',
  //     headers: {
  //       'Content-Type': 'application/json'
  //     },
  //     body: JSON.stringify({
  //       provider: 'marketplace',
  //       query: token
  //     })
  //   })

  //   const json = await result.json()
  //   return json
  // }

  // private async submitToTokenOverlay(tx, topics = [this.tokenTopic]): Promise<SubmitResult> {
  //   const result = await this.authrite.request(`${this.confederacyHost}/submit`, {
  //     method: 'post',
  //     headers: {
  //       'Content-Type': 'application/json'
  //     },
  //     body: JSON.stringify({
  //       ...tx,
  //       topics
  //     })
  //   })
  //   const json = await result.json()
  //   console.log('submit to overlay', json)
  //   return json
  // }

  // private async submitToMarketplaceOverlay(tx, topics = [this.marketplaceTopic]): Promise<SubmitResult> {
  //   const result = await this.authrite.request(`${this.confederacyHost}/submit`, {
  //     method: 'post',
  //     headers: {
  //       'Content-Type': 'application/json'
  //     },
  //     body: JSON.stringify({
  //       ...tx,
  //       topics
  //     })
  //   })
  //   const json = await result.json()
  //   console.log('submit to overlay', json)
  //   return json
  // }

  // private getCounterpartyFromInstructions(i): string {
  //   if (!i) {
  //     return 'self'
  //   }
  //   while (typeof i === 'string') {
  //     i = JSON.parse(i)
  //   }
  //   return i.sender
  // }

  // private getKeyIDFromInstructions(i): string {
  //   if (!i) {
  //     return '1'
  //   }
  //   while (typeof i === 'string') {
  //     i = JSON.parse(i)
  //   }
  //   return i.keyID || '1'
  // }

  async forceAcknowledgeAll() {
    const callId = makeDebugCallId('forceAcknowledgeAll')
    btmsDebug(`${callId}: START`)

    const custodyBox = this.tokensMessageBox

    const msgs = await this.tokenator.listMessages({ messageBox: custodyBox })

    if (!msgs.length) {
      btmsDebug(`${callId}: no messages to acknowledge`)
      return
    }

    const ids = msgs.map(m => m.messageId)

    btmsDebug(`${callId}: acknowledging`, { count: ids.length, ids })

    await this.tokenator.acknowledgeMessages({ messageIds: ids })

    btmsDebug(`${callId}: COMPLETE`)
  }
}

export { walletClient }
/**
 * Normalize wallet-provided labels.
 *
 * Wallet always lowercases labels internally, but developers often forget
 * and compare against mixed-case patterns (e.g. "btmsToken v1 assetId=foo_v1").
 * This function guarantees consistent matching.
 *
 * @param label original label from WalletOutput.labels
 * @returns lowercased, trimmed, normalized string
 */
export function getNormalisedLabel(label: string): string {
  if (typeof label !== 'string') return ''
  return label.trim().toLowerCase()
}

// ---------------------------------------------------------------------------
// BTMS HMR-RESILIENT SINGLETON
// ---------------------------------------------------------------------------

declare const window: any

type BTMSGlobalScope = {
  __BTMS_SINGLETON__?: BTMS
  __BTMS_SOURCE_TAG__?: string
}

const globalScope = window as unknown as BTMSGlobalScope

// If there is no singleton yet, or the source tag changed (new build),
// create a fresh instance. Otherwise, reuse the existing one.
if (!globalScope.__BTMS_SINGLETON__ || globalScope.__BTMS_SOURCE_TAG__ !== BTMS_SOURCE_TAG) {
  console.info('[BTMS HMR] Creating fresh BTMS singleton', {
    prevTag: globalScope.__BTMS_SOURCE_TAG__,
    newTag: BTMS_SOURCE_TAG
  })

  globalScope.__BTMS_SINGLETON__ = new BTMS(walletClient)
  globalScope.__BTMS_SOURCE_TAG__ = BTMS_SOURCE_TAG
} else {
  console.info('[BTMS HMR] Reusing existing BTMS singleton', {
    tag: globalScope.__BTMS_SOURCE_TAG__
  })
}

// Export singleton
export const btms = globalScope.__BTMS_SINGLETON__ as BTMS
btms.initAfterConstructor()
  ; (globalThis as any).btms = btms // <-- enable DevTools debugging
