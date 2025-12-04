/**
 * BTMS Type Definitions
 *
 * All interfaces and types used by the BTMS token management system.
 */

import {
  TXIDHexString,
  HexString,
  BasketStringUnder300Bytes,
  SatoshiValue,
  WalletCounterparty,
  KeyIDStringUnder800Bytes,
  DescriptionString5to50Bytes,
  AtomicBEEF,
  WalletOutput
} from '@bsv/sdk'

/**
 * Represents a BTMS token asset with balance and metadata.
 */
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
   */
  hasPendingIncoming: boolean
}

/**
 * Minimal "old-world output" shape for ownership proofs.
 */
export interface GetTransactionOutputResult {
  txid: TXIDHexString
  vout: number
  lockingScript: HexString
  satoshis: SatoshiValue
  basket?: BasketStringUnder300Bytes
}

/**
 * Minimal linkage shape for key linkage results.
 */
export interface SpecificKeyLinkageResult {
  assetId: string
  amount: number
}

/**
 * Token object delivered to recipients via MessageBox.
 */
export interface TokenForRecipient {
  txid: TXIDHexString
  vout: number
  /** Logical token quantity (e.g. 4 CAT), not satoshis. */
  amount: number
  /** Underlying satoshi value in the UTXO. */
  satoshis: SatoshiValue
  /** Canonical BEEF form (AtomicBEEF = Uint8Array). */
  beef: AtomicBEEF
  /** Plain number[] form preferred by receiver. */
  beefPayload?: number[]
  /** Branded key ID from WalletInterface. */
  keyID: KeyIDStringUnder800Bytes
  /** Always a HEX string inside BTMS. */
  lockingScript: HexString
}

/**
 * Result from overlay submission.
 */
export interface SubmitResult {
  status: 'success'
  topics: Record<string, number[]>
}

/**
 * Result from overlay search queries.
 */
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

/**
 * Incoming payment from MessageBox.
 */
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
  /** Used for UI + internal fixes */
  stillPending?: boolean
}

/**
 * Proof of token ownership for verification.
 */
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

/**
 * Marketplace listing entry.
 */
export interface MarketplaceEntry {
  assetId: string
  amount: number
  seller: WalletCounterparty
  description: DescriptionString5to50Bytes
  desiredAssets: Record<string, number>
  ownershipProof: OwnershipProof
  metadata: string
}

/**
 * Marketplace trade offer.
 */
export interface MarketplaceOffer {
  buyerOffersAssetId: string
  buyerOffersAmount: number
  buyerProof: OwnershipProof
  buyerPartialTX: string
  sellerEntry: MarketplaceEntry
  fundingKeyID: KeyIDStringUnder800Bytes
  messageId?: string
  rejected?: boolean
  isAsDesiredBySeller?: boolean
}

/**
 * Custom instructions for buyer offers.
 * @internal
 */
export interface BuyerOfferCustomInstructions {
  buyerProof: OwnershipProof
  buyerOfferedAssetId: string
  buyerOfferedAmount: number
  sellerEntry: MarketplaceEntry
  fundingKeyID: KeyIDStringUnder800Bytes
}

/**
 * Extended WalletOutput with BTMS-specific fields.
 */
export interface BTMSWalletOutput extends WalletOutput {
  /** AtomicBEEF binary as number[] */
  tx?: number
  /** New-world equivalent of vout */
  outputIndex?: number
  /** Fallback for older outputs */
  vout?: number
  /** JSON string from createAction */
  customInstructions?: string
}

/**
 * Result of decoding a BTMS token script.
 */
export type DecodedBTMSToken =
  | {
    valid: true
    assetId: string
    amount: number
    op: 'ISSUE' | 'TRANSFER'
    metadata: string
    signature: string
    lockingPublicKey?: string
  }
  | {
    valid: false
    fieldsLength?: number
  }
