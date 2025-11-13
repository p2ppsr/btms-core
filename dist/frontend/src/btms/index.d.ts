export type ProtocolID = string | [number, string];
/** New-world shape replacing "EnvelopeApi" */
export interface BeefPayload {
    rawTx?: string;
    inputs?: any;
    mapiResponses?: any;
    proof?: any;
    outputs?: any;
    txid?: string;
}
/** @deprecated Use BeefPayload instead. Kept as a type alias for transition. */
export interface BTMSWallet {
    getPublicKey(args: {
        identityKey?: boolean;
        protocolID?: ProtocolID;
        keyID?: string;
        counterparty?: string;
        forSelf?: boolean;
    }): Promise<string>;
    createSignature(args: {
        data: Uint8Array;
        protocolID: ProtocolID;
        keyID: string;
        counterparty: string;
    }): Promise<Uint8Array>;
    createAction(args: any): Promise<CreateActionResult>;
    submitDirectTransaction(args: any): Promise<void>;
    listActions(args: any): Promise<{
        transactions: any[];
        total: number;
    }>;
    revealKeyLinkage(args: {
        mode: 'specific';
        counterparty: string;
        protocolID: [number, string];
        keyID: string;
        verifier: string;
        description?: string;
    }): Promise<SpecificKeyLinkageResult | CounterpartyKeyLinkageResult>;
    decrypt?(args: {
        ciphertext: Uint8Array;
        counterparty: string;
        protocolID: [number, string];
        keyID: string;
        returnType: 'Uint8Array';
    }): Promise<Uint8Array>;
}
export interface CreateActionOutput {
    lockingScript?: string;
    script?: string;
    satoshis: number;
    basket?: string;
    description?: string;
    tags?: string[];
    customInstructions?: string;
}
export interface CreateActionInput extends BeefPayload {
    outputsToRedeem: Array<{
        index: number;
        spendingDescription?: string;
        unlockingScript: string;
    }>;
}
export interface CreateActionResult extends BeefPayload {
    description?: string;
    topics?: Record<string, number[]>;
    /** often used by wallets for "Atomic BEEF" */
    tx?: string;
    atomicBeef?: string;
    beef?: string;
}
export interface GetTransactionOutputResult {
    txid: string;
    vout: number;
    outputScript: string;
    /** renamed from `envelope` */
    beefPayload?: BeefPayload;
    customInstructions?: string;
    basket?: string;
    satoshis?: number;
}
export interface SpecificKeyLinkageResult {
    prover: string;
    protocolID: [number, string];
    keyID: string;
    encryptedLinkage: Uint8Array;
}
export interface CounterpartyKeyLinkageResult {
    prover: string;
    encryptedLinkage: Uint8Array;
}
declare function setBTMSAuthFetch(fn: (url: string, init?: RequestInit) => Promise<Response>): void;
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
    amount: number;
    metadata?: Record<string, unknown> | string;
}
export declare function createLocalToken(assetId: string, amount: number, metadata?: Record<string, unknown> | string): LocalToken;
export interface MarketplaceItem {
    assetId: string;
    amount: number;
    seller: string;
    description?: string;
    desiredAssets?: Record<string, number>;
    metadata?: string;
}
export declare function listMarketplaceItems(client: OverlayClient, query?: {
    findAll?: boolean;
    seller?: string;
}): Promise<MarketplaceItem[]>;
export declare function createMarketplaceItem(client: OverlayClient, item: MarketplaceItem): Promise<{
    status: string;
}>;
export interface DecodedLinkage {
    prover: string;
    derivedKey: string;
}
export declare function decodeLinkageSimple(prover: string, linkageScalarHex: string): DecodedLinkage;
export interface Asset {
    assetId: string;
    balance: number;
    name?: string;
    iconURL?: string;
    metadata?: string;
    incoming?: boolean;
    incomingAmount?: number;
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
    var __btmsGlobalCache__: BTMSGlobalCache | undefined;
}
export interface TokenForRecipient {
    txid: string;
    vout: number;
    amount: number;
    /** renamed from `envelope` */
    beefPayload: CreateActionResult;
    keyID: string;
    outputScript: string;
}
export interface SubmitResult {
    status: 'success';
    topics: Record<string, number[]>;
}
export interface OverlaySearchResult {
    inputs: string | null;
    mapiResponses: string | null;
    outputScript: string;
    proof: string | null;
    rawTx: string;
    satoshis: number;
    txid: string;
    vout: number;
}
export interface IncomingPayment {
    txid: string;
    vout: number;
    outputScript: string;
    amount: number;
    token: TokenForRecipient;
    sender: string;
    messageId: string;
    keyID: string;
    /** renamed from `envelope` */
    beefPayload: CreateActionResult;
}
export interface OwnershipProof {
    prover: string;
    verifier: string;
    assetId: string;
    amount: number;
    tokens: {
        output: GetTransactionOutputResult;
        linkage: SpecificKeyLinkageResult;
    }[];
}
export interface MarketplaceEntry {
    assetId: string;
    amount: number;
    seller: string;
    description: string;
    desiredAssets: Record<string, number>;
    ownershipProof: OwnershipProof;
    metadata: string;
}
export interface MarketplaceOffer {
    buyerOffersAssetId: string;
    buyerOffersAmount: number;
    buyerProof: OwnershipProof;
    buyerPartialTX: string;
    /** renamed from `buyerFundingEnvelope` */
    buyerFundingBeefPayload: CreateActionResult | BeefPayload;
    sellerEntry: MarketplaceEntry;
    fundingKeyID: string;
    messageId?: string;
    rejected?: boolean;
    isAsDesiredBySeller?: boolean;
    desiredSellerKeyID?: string;
    desiredSellerChangeKeyID?: string;
    desiredBuyerKeyID?: string;
    desiredBuyerChangeKeyID?: string;
}
/**
 * Helper args for the high-level sendBTMSToken(...) helper.
 * This wraps walletClient.createAction + btms.send so we always
 * carry an AtomicBEEF beefPayload end-to-end.
 */
export interface SendBTMSTokenArgs {
    recipient: string;
    assetId: string;
    amount: number;
    keyID?: string;
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
    acknowledgeMessage(args: {
        messageIds: string[];
    }): Promise<void>;
    acknowledgeMessages(args: {
        messageIds: string[];
    }): Promise<void>;
}
export declare class BTMS {
    tokenator: MessageBoxTokenator;
    tokensMessageBox: string;
    marketplaceMessageBox: string;
    protocolID: [number, string];
    basket: string;
    tokenTopic: string;
    satoshis: number;
    privateKey: string | undefined;
    marketplaceTopic: string;
    private requester;
    private instanceId;
    private lookupResolver?;
    constructor(tokensMessageBox?: string, protocolID?: [number, string] | string, basket?: string, tokensTopic?: string, satoshis?: number, privateKey?: string, marketplaceMessageBox?: string, marketplaceTopic?: string);
    getPublicKey(args: {
        identityKey?: boolean;
        protocolID?: ProtocolID;
        keyID?: string;
        counterparty?: string;
        forSelf?: boolean;
    }): Promise<string>;
    listAssets(): Promise<Asset[]>;
    listIncomingPayments(assetId?: string): Promise<IncomingPayment[]>;
    acceptIncomingPayment(assetId: string, payment: IncomingPayment): Promise<void>;
    refundIncomingTransaction(_assetId: string, payment: IncomingPayment): Promise<void>;
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
        outputScript: string;
        assetId: string;
        amount: number;
        metadata: string;
        /** renamed from `envelope` */
        beefPayload?: any;
        atomicBeef: string | null;
    }>;
}
declare const btmsInstance: BTMS;
declare const defaultExport: any;
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
