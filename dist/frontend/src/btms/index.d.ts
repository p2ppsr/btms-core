import {
  TXIDHexString as SDKTXIDHexString,
  SatoshiValue as SDKSatoshiValue,
  HexString as SDKHexString,
  KeyIDStringUnder800Bytes as SDKKeyIDStringUnder800Bytes,
  WalletCounterparty as SDKWalletCounterparty,
  BasketStringUnder300Bytes as SDKBasketStringUnder300Bytes,
} from "@bsv/sdk";
type HexString = SDKHexString;
type TXIDHexString = SDKTXIDHexString;
type BasketStringUnder300Bytes = SDKBasketStringUnder300Bytes;
type SatoshiValue = SDKSatoshiValue;
type WalletProtocol = (string | number)[];
type KeyIDStringUnder800Bytes = SDKKeyIDStringUnder800Bytes;
type WalletCounterparty = SDKWalletCounterparty | "self" | "anyone";
/**
 * New-world shape replacing "EnvelopeApi"
 */
export interface BeefPayload {
  rawTx?: string;
  inputs?: any;
  mapiResponses?: any;
  proof?: any;
  outputs?: any;
  txid?: TXIDHexString;
}
export interface CreateActionOutput {
  lockingScript?: HexString;
  script?: string;
  satoshis: SatoshiValue;
  basket?: BasketStringUnder300Bytes;
  description?: string;
  tags?: string[];
  customInstructions?: string;
}
export interface CreateActionInput extends BeefPayload {
  outputsToRedeem: Array<{
    index: number;
    spendingDescription?: string;
    unlockingScript: HexString;
  }>;
}
export interface CreateActionResult extends BeefPayload {
  description?: string;
  topics?: Record<string, number[]>;
  tx?: string;
  atomicBeef?: string;
  beef?: string;
}
export interface GetTransactionOutputResult {
  txid: TXIDHexString;
  vout: number;
  lockingScript: HexString;
  beefPayload?: BeefPayload;
  customInstructions?: string;
  basket?: BasketStringUnder300Bytes;
  satoshis?: SatoshiValue;
}
export interface SpecificKeyLinkageResult {
  prover: string;
  protocolID: WalletProtocol;
  keyID: KeyIDStringUnder800Bytes;
  encryptedLinkage: Uint8Array;
}
export interface CounterpartyKeyLinkageResult {
  prover: string;
  encryptedLinkage: Uint8Array;
}
declare function setBTMSAuthFetch(
  fn: (url: string, init?: RequestInit) => Promise<Response>,
): void;
declare class OverlayClient {
  baseUrl: string;
  apiKey?: string;
  constructor(baseUrl: string, apiKey?: string);
  private buildHeaders;
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body: unknown): Promise<T>;
}
export interface LocalToken {
  id: string;
  assetId: string;
  amount: SatoshiValue;
  metadata?: Record<string, unknown> | string;
}
export declare function createLocalToken(
  assetId: string,
  amount: SatoshiValue,
  metadata?: Record<string, unknown> | string,
): LocalToken;
export interface MarketplaceItem {
  assetId: string;
  amount: SatoshiValue;
  seller: string;
  description?: string;
  desiredAssets?: Record<string, number>;
  metadata?: string;
}
export declare function listMarketplaceItems(
  client: OverlayClient,
  query?: {
    findAll?: boolean;
    seller?: string;
  },
): Promise<MarketplaceItem[]>;
export declare function createMarketplaceItem(
  client: OverlayClient,
  item: MarketplaceItem,
): Promise<{
  status: string;
}>;
export interface DecodedLinkage {
  prover: string;
  derivedKey: string;
}
export declare function decodeLinkageSimple(
  prover: string,
  linkageScalarHex: string,
): DecodedLinkage;
export interface Asset {
  assetId: string;
  balance: SatoshiValue;
  name?: string;
  iconURL?: string;
  metadata?: string;
  incoming?: boolean;
  incomingAmount?: SatoshiValue;
  new?: boolean;
}
type BTMSGlobalCache = {
  lastAssetSnapshot: Asset[];
  lastAssetFetchMs: number;
  /**
   * <- NEW: once we’ve tried fetching at least once (even if it was empty or permissiony)
   * we set this to true so future calls can stop hammering the wallet every 30s
   * when there’s still nothing there.
   */
  hasFetchedOnce: boolean;
};
declare global {
  var __btmsGlobalCacheNW__: BTMSGlobalCache | undefined;
}
export interface TokenForRecipient {
  txid: TXIDHexString;
  vout: number;
  amount: SatoshiValue;
  /** renamed from `envelope` */
  beefPayload: CreateActionResult;
  keyID: KeyIDStringUnder800Bytes;
  lockingScript: HexString;
}
export interface SubmitResult {
  status: "success";
  topics: Record<string, number[]>;
}
export interface OverlaySearchResult {
  inputs: string | null;
  mapiResponses: string | null;
  lockingScript: HexString;
  proof: string | null;
  rawTx: string;
  satoshis: SatoshiValue;
  txid: TXIDHexString;
  vout: number;
  beef?: number[];
}
export interface IncomingPayment {
  txid: TXIDHexString;
  vout: number;
  lockingScript: HexString;
  amount: SatoshiValue;
  token: TokenForRecipient;
  sender: string;
  messageId: string;
  keyID: KeyIDStringUnder800Bytes;
  /** renamed from `envelope` */
  beefPayload: CreateActionResult;
}
export interface OwnershipProof {
  prover: string;
  verifier: string;
  assetId: string;
  amount: SatoshiValue;
  tokens: {
    output: GetTransactionOutputResult;
    linkage: SpecificKeyLinkageResult;
  }[];
}
export interface MarketplaceEntry {
  assetId: string;
  amount: SatoshiValue;
  seller: string;
  description: string;
  desiredAssets: Record<string, number>;
  ownershipProof: OwnershipProof;
  metadata: string;
}
export interface MarketplaceOffer {
  buyerOffersAssetId: string;
  buyerOffersamount: SatoshiValue;
  buyerProof: OwnershipProof;
  buyerPartialTX: string;
  /** renamed from `buyerFundingEnvelope` */
  buyerFundingBeefPayload: CreateActionResult | BeefPayload;
  sellerEntry: MarketplaceEntry;
  fundingkeyID: KeyIDStringUnder800Bytes;
  messageId?: string;
  rejected?: boolean;
  isAsDesiredBySeller?: boolean;
  desiredSellerkeyID?: KeyIDStringUnder800Bytes;
  desiredSellerChangekeyID?: KeyIDStringUnder800Bytes;
  desiredBuyerkeyID?: KeyIDStringUnder800Bytes;
  desiredBuyerChangekeyID?: KeyIDStringUnder800Bytes;
}
/**
 * Helper args for the high-level sendBTMSToken(...) helper.
 * This wraps walletClient.createAction + btms.send so we always
 * carry an AtomicBEEF beefPayload end-to-end.
 */
export interface SendBTMSTokenArgs {
  recipient: string;
  assetId: string;
  amount: SatoshiValue;
  keyID?: KeyIDStringUnder800Bytes;
  messageBox?: string;
  description?: string;
  /**
   * Exact CreateAction args to hand to walletClient.createAction.
   * You build the inputs/outputs as usual in your UI and pass them here.
   */
  createActionArgs: any;
  /**
   * Optional vout index of the token output inside the created tx.
   * Defaults to 0 if omitted.
   */
  tokenVout?: number;
}
declare class MessageBoxTokenator {
  private wallet;
  private defaultBox;
  private host;
  private client;
  private initPromise;
  constructor(wallet: any, defaultBox: string, host?: string);
  private ensureClient;
  sendMessage(args: {
    recipient: string;
    messageBox?: string;
    body: any;
  }): Promise<void>;
  listMessages(args: {
    messageBox?: string;
  }): Promise<import("@bsv/message-box-client").PeerMessage[]>;
  acknowledgeMessage(args: { messageIds: string[] }): Promise<void>;
  acknowledgeMessages(args: { messageIds: string[] }): Promise<void>;
}
export declare class BTMS {
  tokenator: MessageBoxTokenator;
  tokensMessageBox: string;
  marketplaceMessageBox: string;
  protocolID: WalletProtocol;
  basket: BasketStringUnder300Bytes;
  tokenTopic: string;
  satoshis: SatoshiValue;
  privateKey: string | undefined;
  marketplaceTopic: string;
  private requester;
  private instanceId;
  constructor(
    tokensMessageBox?: string,
    protocolID?: WalletProtocol,
    basket?: string,
    tokensTopic?: string,
    satoshis?: SatoshiValue,
    privateKey?: string,
    marketplaceMessageBox?: string,
    marketplaceTopic?: string,
  );
  getPublicKey(args: {
    identityKey?: boolean;
    protocolID?: WalletProtocol;
    keyID?: KeyIDStringUnder800Bytes;
    counterparty?: WalletCounterparty;
    forSelf?: boolean;
  }): Promise<string>;
  listAssets(): Promise<Asset[]>;
  listIncomingPayments(assetId?: string): Promise<IncomingPayment[]>;
  acceptIncomingPayment(
    assetId: string,
    payment: IncomingPayment,
  ): Promise<void>;
  refundIncomingTransaction(
    _assetId: string,
    payment: IncomingPayment,
  ): Promise<void>;
  /**
   * Send a BTMS-style payment/message to another identity via message-box-client.
   * Hydration order: LookupResolver (Meter default) -> HTTP LARS (localhost:8080).
   * Requires a non-empty AtomicBEEF (number[]/Uint8Array) OR resolves {txid,vout}
   * automatically from the selected token (no UI txid/vout fields needed).
   */
  send(...raw: Array<any | string | number>): Promise<void>;
  private findFromTokenOverlay;
  private submitToTokenOverlay;
  issue(...rawArgs: any[]): Promise<{
    assetId: string;
    amount: SatoshiValue;
    metadata: string;
    /** renamed from `envelope` */
    beefPayload?: any;
    atomicBeef: string | null;
  }>;
}
declare const btmsInstance: BTMS;
declare const defaultExport: any;
/**
 * Accept an incoming BTMS payment that was sent via MessageBox.
 * `beefPayload` is the wallet action you sent from sendBTMSToken.
 */
export declare function acceptBTMSPayment(beefPayload: any): Promise<void>;
/**
 * Thin helper that centralises BTMS send behaviour.
 *
 * - Normalises amount to a number
 * - Validates assetId / recipient
 * - Adds a per-call ID so logs can be correlated
 * - Delegates to btmsInstance.send(...) which will:
 *   * auto-select an outpoint for this assetId (from wallet.listOutputs)
 *   * hydrate AtomicBEEF (LookupResolver + HTTP, if needed)
 *   * send a MessageBox message containing { token, beef, beefPayload }
 */
export declare function sendBTMSToken(rawArgs: any): Promise<void>;
export { setBTMSAuthFetch, OverlayClient, btmsInstance as btms };
export default defaultExport;
