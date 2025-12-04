import { LockingScript, UnlockingScript, AtomicBEEF, TXIDHexString, HexString, Transaction, DescriptionString5to50Bytes, BasketStringUnder300Bytes, SatoshiValue, WalletProtocol, KeyIDStringUnder800Bytes, WalletCounterparty, BroadcastResponse, BroadcastFailure, WalletOutput, ListOutputsArgs, WalletInterface } from '@bsv/sdk';
export declare function setBTMSAuthFetch(fn: (url: string, init?: RequestInit) => Promise<Response>): void;
declare class MessageBoxTokenator {
    private walletClient;
    private defaultBox;
    private host;
    private client;
    private initPromise;
    constructor(walletClient: WalletInterface, defaultBox: string, host?: string);
    private static isUint8Array;
    private static isNumberArray;
    private static safeParseJSON;
    private ensureClient;
    sendMessage(args: {
        recipient: string;
        messageBox?: string;
        body: string;
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
export interface GetTransactionOutputResult {
    txid: TXIDHexString;
    vout: number;
    lockingScript: HexString;
    satoshis: SatoshiValue;
    basket?: BasketStringUnder300Bytes;
}
export interface SpecificKeyLinkageResult {
    assetId: string;
    amount: number;
}
export interface TokenForRecipient {
    txid: TXIDHexString;
    vout: number;
    /**
     * Logical token quantity (e.g. 4 CAT), not satoshis.
     */
    amount: number;
    /**
     * Underlying satoshi value in the UTXO.
     */
    satoshis: SatoshiValue;
    /**
     * Canonical BEEF form (AtomicBEEF = Uint8Array).
     * We normalise any incoming BEEF to this at the edges.
     */
    beef: AtomicBEEF;
    /**
     * Branded key ID from WalletInterface.
     */
    keyID: KeyIDStringUnder800Bytes;
    /**
     * Always a HEX string inside BTMS.
     */
    lockingScript: HexString;
}
export interface SubmitResult {
    status: 'success';
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
}
export interface IncomingPayment {
    tx: AtomicBEEF;
    txid: TXIDHexString;
    vout: number;
    lockingScript: HexString;
    amount: number;
    satoshis: SatoshiValue;
    sender: WalletCounterparty;
    messageId?: string;
    keyID: KeyIDStringUnder800Bytes;
    assetId: string;
}
export interface OwnershipProof {
    prover: WalletCounterparty;
    verifier: WalletCounterparty;
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
    seller: WalletCounterparty;
    description: DescriptionString5to50Bytes;
    desiredAssets: Record<string, number>;
    ownershipProof: OwnershipProof;
    metadata: string;
}
export interface MarketplaceOffer {
    buyerOffersAssetId: string;
    buyerOffersAmount: number;
    buyerProof: OwnershipProof;
    buyerPartialTX: string;
    sellerEntry: MarketplaceEntry;
    fundingKeyID: KeyIDStringUnder800Bytes;
    messageId?: string;
    rejected?: boolean;
    isAsDesiredBySeller?: boolean;
}
export interface BTMSWalletOutput extends WalletOutput {
    tx?: number;
    outputIndex?: number;
    vout?: number;
    customInstructions?: string;
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
export declare class BTMSFundingToken {
    private walletClient;
    constructor(walletClient?: WalletInterface);
    /**
     * Create a P2PKH locking script for a fee-funding UTXO.
     * Always returns HEX.
     */
    lock(protocolID: WalletProtocol, keyID: string, counterparty: WalletCounterparty): Promise<LockingScript>;
    /**
     * Unlocker for the funding UTXO.
     * Uses PushDrop.unlock(), same as hello-tokens.
     */
    unlock(protocolID: WalletProtocol, keyID: string, counterparty: WalletCounterparty): {
        sign: (tx: Transaction, inputIndex: number) => Promise<UnlockingScript>;
        estimateLength: () => Promise<73>;
    };
}
export declare class BTMS {
    tokenator: MessageBoxTokenator;
    tokensMessageBox: string;
    marketplaceMessageBox: string;
    protocolID: WalletProtocol;
    protocolKeyID: KeyIDStringUnder800Bytes;
    basket: BasketStringUnder300Bytes;
    tokenTopic: string;
    satoshis: SatoshiValue;
    privateKey: string | undefined;
    marketplaceTopic: string;
    private requester;
    private instanceId;
    basketPrefix: BasketStringUnder300Bytes;
    private getRandomKeyID;
    constructor(tokensMessageBox?: string, protocolID?: WalletProtocol, protocolKeyID?: KeyIDStringUnder800Bytes, basket?: BasketStringUnder300Bytes, tokensTopic?: string, satoshis?: SatoshiValue, privateKey?: string, marketplaceMessageBox?: string, marketplaceTopic?: string);
    /**
     * Always return HEX string for locking scripts.
     * Accepts: hex string, number[], Uint8Array
     */
    private toLockingScriptHex;
    /**
     * Always convert any BEEF-like value to AtomicBEEF (number[]).
     * BTMS internal canonical BEEF type is number[] (AtomicBEEF).
     */
    private toAtomicBeef;
    getTokens(assetId: string): Promise<BTMSWalletOutput[]>;
    getBalance(assetId: string, myTokens?: BTMSWalletOutput[]): Promise<number>;
    /**
     * ISSUE: create brand-new BTMS tokens under basket "btms <name>"
     */
    issue(amount: number, name: string, assetId: string, metadata: string): Promise<BroadcastResponse | BroadcastFailure>;
    listAssets(includeMode?: ListOutputsArgs["include"]): Promise<Asset[] | null>;
    send(assetId: string, recipient: string, sendAmount: number, onPaymentSent?: (payment: TokenForRecipient) => void): Promise<SubmitResult>;
    acceptIncomingPayment(assetId: string, payment: IncomingPayment): Promise<boolean>;
    /**
     * NEW-WORLD listAssets(): wallet = truth, overlays only supplement metadata.
     */
    listIncomingPayments(assetId?: string): Promise<IncomingPayment[]>;
    /**
     * Refund an incoming BTMS token back to sender.
     * (New-world createAction → signAction pattern)
     */
    refundIncomingTransaction(assetId: string, payment: IncomingPayment): Promise<SubmitResult>;
    getTransactions(assetId: string, limit: number, offset: number): Promise<{
        transactions: {
            date: string;
            amount: number;
            txid: string;
            counterparty: WalletCounterparty;
        }[];
    }>;
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
    private verifyIncomingToken;
}
export declare const btms: BTMS;
export {};
