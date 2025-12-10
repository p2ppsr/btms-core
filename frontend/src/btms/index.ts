/**
 * BTMS - BSV Token Management System
 *
 * Core token management functionality for issuing, sending, receiving,
 * and managing BSV tokens using the PushDrop protocol.
 */

import {
  LockingScript,
  P2PKH,
  PublicKey,
  Utils,
  PushDrop,
  WalletClient,
  AtomicBEEF,
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
  WalletProtocol,
  KeyIDStringUnder800Bytes,
  WalletCounterparty,
  WERR_REVIEW_ACTIONS,
  TopicBroadcaster,
  BroadcastResponse,
  BroadcastFailure,
  CreateActionArgs,
  CreateActionOutput,
  ListOutputsArgs,
  ListOutputsResult,
  ListActionsResult,
  WalletInterface,
  SignActionArgs,
  InternalizeActionArgs,
  PositiveIntegerOrZero,
  LookupResolver
} from '@bsv/sdk'

import { logWithTimestamp } from '../utils/logging'
import { MessageBoxTokenator, configureTokenatorDebug } from './MessageBoxTokenator'

// Re-export types for external consumers
export {
  type Asset,
  type GetTransactionOutputResult,
  type SpecificKeyLinkageResult,
  type TokenForRecipient,
  type SubmitResult,
  type OverlaySearchResult,
  type IncomingPayment,
  type OwnershipProof,
  type MarketplaceEntry,
  type MarketplaceOffer,
  type BTMSWalletOutput,
  type DecodedBTMSToken
} from './types'

import type {
  Asset,
  IncomingPayment,
  TokenForRecipient,
  BTMSWalletOutput,
  SubmitResult
} from './types'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Global debug switch */
const BTMS_DEBUG = false

/** Source tag for HMR detection */
const BTMS_SOURCE_TAG = 'frontend/src/btms/index.ts'

// ---------------------------------------------------------------------------
// BTMS Protocol Constants
// ---------------------------------------------------------------------------
// BRC-99: Baskets prefixed with "p " are permissioned and require wallet
// permission module support. The scheme ID is "btms".
//
// Token basket format: "p btms <assetId>"
// Example: "p btms MyToken123"
// ---------------------------------------------------------------------------

/** Permission scheme ID for BTMS (BRC-99 compliant) */
const BTMS_SCHEME_ID = 'btms'

/** Permissioned basket prefix - requires wallet permission module */
const P_BASKET_PREFIX = `p ${BTMS_SCHEME_ID}`

/** Protocol ID for wallet operations - uses "p btms" for permission module integration */
const PROTOCOL_ID: WalletProtocol = [0, `p ${BTMS_SCHEME_ID}`]

/** Default key ID for protocol operations */
const PROTOCOL_KEY_ID = '1'

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

// Configure tokenator debug logging
configureTokenatorDebug(BTMS_DEBUG, btmsDebug)

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
    forSelf = true
  ): Promise<LockingScript> {
    const callId = makeDebugCallId('BTMSToken.lock')

    // -----------------------------------------------------
    // 1. STRICT 5-FIELD SCHEMA
    // -----------------------------------------------------
    const fields: number[][] = [
      Utils.toArray(assetId, 'utf8'),
      Utils.toArray(String(amount), 'utf8'),
      Utils.toArray(op, 'utf8'),
      Utils.toArray(metadata, 'utf8')
    ]

    // -----------------------------------------------------
    // 2. Build PushDrop locking script
    // -----------------------------------------------------
    const pushdrop = new PushDrop(this.walletClient)
    const lockScript = await pushdrop.lock(fields, protocolID, keyID, counterparty, forSelf)
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
  basketPrefix: BasketStringUnder300Bytes = P_BASKET_PREFIX

  // ---- Incoming Payment Cache Controls ----
  private _lastIncomingResult: IncomingPayment[] | null = null
  // ---- Wallet Overload Detection State ----
  private setAssetsCallback?: (assets: Asset[]) => void

  tokenator: MessageBoxTokenator

  tokensMessageBox: string
  marketplaceMessageBox: string

  protocolID: WalletProtocol
  protocolKeyID: KeyIDStringUnder800Bytes
  basket: BasketStringUnder300Bytes
  tokenTopic: string

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
    basket: BasketStringUnder300Bytes = P_BASKET_PREFIX,
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

    btmsDebug('constructor called', {
      protocolID: this.protocolID,
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
    const basket = `${P_BASKET_PREFIX} ${assetId}`

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
    //    BUT ONLY if it belongs to this wallet AND is spendable.
    // ---------------------------------------------------------
    for (const o of utxos) {
      // Only count spendable outputs
      if (!o.spendable) continue

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
      const basket: BasketStringUnder300Bytes = `${this.basketPrefix} ${assetId}`

      // unified identity lookup
      const { publicKey: myIdentityKey } = await this.walletClient.getPublicKey({
        identityKey: true
      })

      const keyID = this.getRandomKeyID()

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
        'ISSUE'
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

  /**
   * Send BTMS tokens to a recipient.
   * 
   * This function selects enough UTXOs to cover the send amount,
   * consumes them all as inputs, and creates appropriate change output.
   */
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
      /* 1) Validate send amount                                            */
      /* ------------------------------------------------------------------ */
      if (!Number.isFinite(sendAmount) || sendAmount <= 0) {
        throw new Error('BTMS send: amount must be greater than zero.')
      }

      /* ------------------------------------------------------------------ */
      /* 2) Fetch all spendable UTXOs for this asset                        */
      /* ------------------------------------------------------------------ */
      const tokenBasket = `${this.basketPrefix} ${assetId}` as BasketStringUnder300Bytes

      const beefListArgs: ListOutputsArgs = {
        basket: tokenBasket,
        include: 'entire transactions',
        includeTags: true,
        includeLabels: true,
        seekPermission: true,
        limit: 100
      }

      let beefResult: ListOutputsResult
      try {
        beefResult = await this.walletClient.listOutputs(beefListArgs)
      } catch (err) {
        throw new Error('BTMS send: failed to fetch BTMS UTXOs for send.')
      }

      if (!beefResult.BEEF) {
        throw new Error('BTMS send: wallet did not return full BEEF for token basket.')
      }

      let beefObj: Beef
      try {
        const beefArray = Utils.toArray(beefResult.BEEF)
        beefObj = Beef.fromBinary(beefArray)
      } catch (error) {
        throw new Error('BTMS send: invalid prior transaction BEEF.')
      }

      /* ------------------------------------------------------------------ */
      /* 3) Decode all spendable UTXOs and their token amounts              */
      /* ------------------------------------------------------------------ */
      interface DecodedUtxo {
        utxo: typeof beefResult.outputs[0]
        txid: string
        vout: number
        tokenAmount: number
        metadataJson: string
        parsedMetadata: { name?: string }
      }

      const decodedUtxos: DecodedUtxo[] = []

      for (const utxo of beefResult.outputs) {
        // Only consider spendable UTXOs with 1 satoshi (BTMS token marker)
        if (!utxo.spendable || utxo.satoshis !== 1) continue

        const [txid, voutStr] = utxo.outpoint.split('.')
        const vout = Number(voutStr)

        // Find the transaction in the BEEF
        const txEntry = beefObj.txs.find(t => t.txid === txid)
        if (!txEntry) continue

        // Get the locking script
        const atomicBEEF = beefObj.toBinaryAtomic(txid)
        const prevTx = Transaction.fromAtomicBEEF(atomicBEEF)
        const prevOut = prevTx.outputs[vout]
        if (!prevOut) continue

        const scriptHex = prevOut.lockingScript.toHex()

        // Decode the PushDrop token
        let decoded
        try {
          decoded = PushDrop.decode(LockingScript.fromHex(scriptHex))
        } catch {
          continue // Not a valid PushDrop, skip
        }

        const utf8Fields = decoded.fields.map(f => Utils.toUTF8(f))
        if (utf8Fields.length < 4) continue

        const tokenName = utf8Fields[0]
        const amtStr = utf8Fields[1]
        const op = utf8Fields[2]
        const metadataJson = utf8Fields[3]

        // Validate token - accept both ISSUE and TRANSFER ops
        if (op !== 'ISSUE' && op !== 'TRANSFER') continue
        if (tokenName.toLowerCase() !== assetId.toLowerCase()) continue

        const tokenAmount = Number(amtStr)
        if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) continue

        let parsedMetadata: { name?: string } = {}
        try {
          parsedMetadata = JSON.parse(metadataJson)
        } catch {
          continue
        }

        decodedUtxos.push({
          utxo,
          txid,
          vout,
          tokenAmount,
          metadataJson,
          parsedMetadata
        })
      }

      btmsDebug(`${callId}: decoded ${decodedUtxos.length} spendable UTXOs`, {
        utxos: decodedUtxos.map(u => ({ outpoint: u.utxo.outpoint, amount: u.tokenAmount }))
      })

      if (decodedUtxos.length === 0) {
        throw new Error('BTMS send: no spendable BTMS UTXOs found for this asset.')
      }

      /* ------------------------------------------------------------------ */
      /* 4) Select UTXOs to cover the send amount (greedy algorithm)        */
      /*    Prefer larger UTXOs first to minimize number of inputs          */
      /* ------------------------------------------------------------------ */
      const sortedUtxos = [...decodedUtxos].sort((a, b) => b.tokenAmount - a.tokenAmount)

      const selectedUtxos: DecodedUtxo[] = []
      let totalInputAmount = 0

      for (const utxo of sortedUtxos) {
        if (totalInputAmount >= sendAmount) break
        selectedUtxos.push(utxo)
        totalInputAmount += utxo.tokenAmount
      }

      if (totalInputAmount < sendAmount) {
        throw new Error(`BTMS send: insufficient tokens. Have ${totalInputAmount}, need ${sendAmount}.`)
      }

      btmsDebug(`${callId}: selected ${selectedUtxos.length} UTXOs`, {
        totalInputAmount,
        sendAmount,
        selected: selectedUtxos.map(u => ({ outpoint: u.utxo.outpoint, amount: u.tokenAmount }))
      })

      // Use metadata from the first selected UTXO
      const metadataJson = selectedUtxos[0].metadataJson
      const tokenDisplayName = selectedUtxos[0].parsedMetadata.name ?? assetId

      /* ------------------------------------------------------------------ */
      /* 5) Load sender identity                                            */
      /* ------------------------------------------------------------------ */
      const { publicKey: myIdentityKey } = await this.walletClient.getPublicKey({
        identityKey: true
      })

      btmsDebug(`${callId}: sender identity`, { myIdentityKey })

      /* ------------------------------------------------------------------ */
      /* 6) Build outputs: recipient + change                               */
      /* ------------------------------------------------------------------ */
      const template = new BTMSToken(walletClient)
      const outputs: CreateActionOutput[] = []

      // Recipient output - locked to recipient's key (or self if sending to self)
      const recipientKeyID = this.getRandomKeyID()
      const isSendingToSelf = myIdentityKey === recipient
      const recipientLockScript = await template.lock(
        PROTOCOL_ID,
        PROTOCOL_KEY_ID,
        isSendingToSelf ? 'self' : recipient,  // Lock to recipient's identity key
        assetId,
        sendAmount,
        metadataJson,
        'TRANSFER'  // This is a transfer, not an issue
      )
      const recipientScriptHex = recipientLockScript.toHex() as HexString

      // Validate recipient output
      const recipientDecoded = this.decodeBTMSToken(recipientScriptHex)
      if (!recipientDecoded.valid) {
        throw new Error('BTMS send: failed to create valid recipient token.')
      }

      const recipientOutput: CreateActionOutput = {
        satoshis: this.satoshis,
        lockingScript: recipientScriptHex,
        outputDescription: `Send ${sendAmount} ${tokenDisplayName}`,
        tags: [isSendingToSelf ? 'owner self' : `owner ${recipient}`] as OutputTagStringUnder300Bytes[],
        // Only put in basket if sending to self; otherwise recipient will internalize via message
        ...(isSendingToSelf ? { basket: tokenBasket } : {}),
        customInstructions: JSON.stringify({
          sender: myIdentityKey,
          recipient,
          keyID: recipientKeyID,
          amount: sendAmount,
          assetId,
          metadata: metadataJson
        })
      }
      outputs.push(recipientOutput)

      // Change output (if any)
      const tokenChangeAmount = totalInputAmount - sendAmount
      btmsDebug(`${callId}: change calculation`, { totalInputAmount, sendAmount, tokenChangeAmount })

      if (tokenChangeAmount > 0) {
        const changeLockScript = await template.lock(
          PROTOCOL_ID,
          PROTOCOL_KEY_ID,
          'self',
          assetId,
          tokenChangeAmount,
          metadataJson,
          'TRANSFER'  // Change from a transfer is also a transfer op
        )
        const changeScriptHex = changeLockScript.toHex() as HexString

        const changeOutput: CreateActionOutput = {
          satoshis: this.satoshis,
          lockingScript: changeScriptHex,
          basket: tokenBasket,
          outputDescription: `Keep ${tokenChangeAmount} ${tokenDisplayName}`,
          tags: ['owner self'] as OutputTagStringUnder300Bytes[],
          customInstructions: JSON.stringify({
            sender: myIdentityKey,
            keyID: this.getRandomKeyID(),
            amount: tokenChangeAmount,
            assetId,
            metadata: metadataJson
          })
        }
        outputs.push(changeOutput)
      }

      /* ------------------------------------------------------------------ */
      /* 7) Build inputs from all selected UTXOs                            */
      /* ------------------------------------------------------------------ */
      const inputs: CreateActionArgs['inputs'] = selectedUtxos.map(u => ({
        outpoint: u.utxo.outpoint as OutpointString,
        unlockingScriptLength: 74,
        inputDescription: `Spend ${u.tokenAmount} ${tokenDisplayName} BTMS token`
      }))

      btmsDebug(`${callId}: createAction inputs`, { inputCount: inputs.length })

      /* ------------------------------------------------------------------ */
      /* 8) createAction                                                    */
      /* ------------------------------------------------------------------ */
      const createActionArgs: CreateActionArgs = {
        description: `Send ${sendAmount} ${tokenDisplayName} to ${recipient}`,
        labels: ['btms' as LabelStringUnder300Bytes],
        inputBEEF: beefObj.toBinary(),
        inputs,
        outputs,
        options: {
          acceptDelayedBroadcast: false,
          randomizeOutputs: false
        }
      }

      const { signableTransaction } = await this.walletClient.createAction(createActionArgs)

      if (!signableTransaction) {
        throw new Error('BTMS send: createAction -> no signableTransaction.')
      }

      /* ------------------------------------------------------------------ */
      /* 9) Sign all inputs with PushDrop.unlock                            */
      /* ------------------------------------------------------------------ */
      const txForSigning = Transaction.fromAtomicBEEF(signableTransaction.tx)
      const unlocker = new PushDrop(walletClient).unlock(PROTOCOL_ID, PROTOCOL_KEY_ID, 'self')

      const spends: Record<number, { unlockingScript: string }> = {}
      for (let i = 0; i < selectedUtxos.length; i++) {
        const unlockingScript = await unlocker.sign(txForSigning, i)
        spends[i] = { unlockingScript: unlockingScript.toHex() }
      }

      /* ------------------------------------------------------------------ */
      /* 10) signAction                                                     */
      /* ------------------------------------------------------------------ */
      const signActionArgs: SignActionArgs = {
        reference: signableTransaction.reference,
        spends
      }

      const signResult = await this.walletClient.signAction(signActionArgs)

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

        await this.tokenator.sendMessage(sendMessageArgs)
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

      const broadcaster = new TopicBroadcaster(broadcasterArgs.topics, broadcasterArgs.options)
      const broadcastResult = await broadcaster.broadcast(finalTxObj)

      if (broadcastResult.status !== 'success') {
        throw new Error(`BTMS send: broadcast failed: ${(broadcastResult as any).reason}`)
      }

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

      throw error
    }
  }

  /******************************************************************************************
   * listAssets() — Uses listActions with 'btms' label for discovery (no discovery basket)
   ******************************************************************************************/
  async listAssets(includeMode: ListOutputsArgs['include'] = 'locking scripts'): Promise<Asset[]> {
    const assetIds = new Set<string>()

    /***************************************************************************
     * STEP A — Discover assets via listActions with 'btms' label
     * Extract asset IDs from output baskets (pattern: "p btms <assetId>")
     ***************************************************************************/
    try {
      const actionsResult: ListActionsResult = await this.walletClient.listActions({
        labels: ['btms'],
        includeOutputs: true,
        limit: 10000
      })

      // Extract asset IDs from output baskets
      const basketPrefix = `${this.basketPrefix} `
      for (const action of actionsResult.actions) {
        for (const output of action.outputs ?? []) {
          if (output.basket?.startsWith(basketPrefix)) {
            // Parse assetId from basket name: "p btms <assetId>"
            const assetId = output.basket.substring(basketPrefix.length)
            if (assetId) {
              assetIds.add(assetId)
            }
          }
        }
      }
    } catch (err) {
      console.error('BTMS listAssets: listActions FAILED', { err })
    }

    /***************************************************************************
     * STEP B — Incoming messagebox payments (STRICT)
     ***************************************************************************/
    let incoming: any[] = []
    try {
      incoming = await this.listIncomingPayments()
    } catch (err) {
      console.error('BTMS listAssets: incoming fetch FAILED', { err })
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
      }
    }

    /***************************************************************************
     * STEP C — Construct Asset models
     ***************************************************************************/
    const discoveredList = [...assetIds]

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
      }
    }

    /***************************************************************************
     * STEP D — Compute balance
     ***************************************************************************/
    for (const id of discoveredList) {
      const bal = await this.getBalance(id)
      assets[id].balance = bal
    }

    /***************************************************************************
     * STEP E — Filter out zero-balance assets (unless they have pending incoming)
     ***************************************************************************/
    const finalList = Object.values(assets).filter(
      asset => asset.balance > 0 || asset.hasPendingIncoming
    )

    return finalList
  }

  async listIncomingPayments(assetId?: string): Promise<IncomingPayment[]> {
    const callId = makeDebugCallId('listIncomingPayments')
    btmsDebug(`${callId}: START`, { filterAssetId: assetId ?? '(ALL)' })

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

    // Accept both ISSUE (newly minted tokens sent directly) and TRANSFER (tokens sent from another user)
    if (opField !== 'ISSUE' && opField !== 'TRANSFER') {
      btmsDebug(`${callId}: ERROR invalid opField`, { opField })
      throw new Error(`acceptIncomingPayment: unsupported op "${opField}" (must be ISSUE or TRANSFER)`)
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
    const basketName = `${P_BASKET_PREFIX} ${canonicalAssetId}` as BasketStringUnder300Bytes

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
      const traceBasketName = `${P_BASKET_PREFIX} ${canonicalAssetId}`
      btmsDebug(`${callId}: listOutputs for basket`, { basketName: traceBasketName })

      const outputs = await this.walletClient.listOutputs({
        basket: traceBasketName as BasketStringUnder300Bytes,
        include: 'locking scripts',
        includeTags: true,
        includeLabels: true,
        seekPermission: true,
        limit: 10000
      })

      btmsDebug(`${callId}: listOutputs result`, {
        basketName: traceBasketName,
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

  // NOTE: Marketplace functionality (proveOwnership, verifyOwnership, listAssetForSale,
  // findAllAssetsForSale, makeOffer, etc.) has been moved to marketplace.ts.disabled
  // for reference. Re-enable and update imports if marketplace features are needed.

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
 * and compare against mixed-case patterns (e.g. "p btms MyToken").
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
