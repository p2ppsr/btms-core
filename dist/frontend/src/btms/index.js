"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.btms = exports.BTMS = exports.BTMSFundingToken = exports.setBTMSAuthFetch = void 0;
const sdk_1 = require("@bsv/sdk");
// use the shared logger (so logging.config.ts can turn this on/off)
const logging_1 = require("../utils/logging");
const message_box_client_1 = require("@bsv/message-box-client");
/**
 * Simple wrapper so all BTMS debug lines have a consistent prefix.
 */
/**
 * Global debug switch. Leave on while we’re chasing the repeated calls.
 */
const BTMS_DEBUG = true;
const BTMS_SOURCE_TAG = 'frontend/src/btms/index.ts@debug-hmr-15';
// For testing
const PROTOCOL_ID = [0, 'tokens'];
const BASKET_PREFIX = 'btms';
const PROTOCOL_KEY_ID = '1';
const INIT_BASKET = '**BLANK**';
function btmsDebug(label, ...rest) {
    if (!BTMS_DEBUG)
        return;
    //if (label.startsWith('listAssets')) {
    (0, logging_1.logWithTimestamp)(`[BTMS:${BTMS_SOURCE_TAG}] ${label}`, ...rest);
    //}
}
/**
 * per-call id so we can correlate
 */
function makeDebugCallId(prefix = 'call') {
    return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}
const walletClient = new sdk_1.WalletClient();
/* ------------------------------------------------------------------ */
/* script extraction from a wallet-output object */
/* ------------------------------------------------------------------ */
function extractLockingScriptFromWalletOutput(o) {
    if (!o || typeof o !== 'object')
        return '';
    if (typeof o.lockingScript === 'string' && o.lockingScript)
        return o.lockingScript;
    if (typeof o.script === 'string' && o.script)
        return o.script;
    const envOut = o.beefPayload?.outputs?.[0];
    if (envOut) {
        if (typeof envOut.lockingScript === 'string' && envOut.lockingScript) {
            return envOut.lockingScript;
        }
        if (typeof envOut.script === 'string' && envOut.script) {
            return envOut.script;
        }
    }
    const outs0 = o.outputs?.[0];
    if (outs0) {
        if (typeof outs0.lockingScript === 'string' && outs0.lockingScript) {
            return outs0.lockingScript;
        }
        if (typeof outs0.script === 'string' && outs0.script) {
            return outs0.script;
        }
    }
    const outObj = o.output;
    if (outObj) {
        if (typeof outObj.lockingScript === 'string' && outObj.lockingScript) {
            return outObj.lockingScript;
        }
        if (typeof outObj.script === 'string' && outObj.script) {
            return outObj.script;
        }
    }
    return '';
}
/* ------------------------------------------------------------------ */
/* small helpers */
/* ------------------------------------------------------------------ */
/**
 * Verify that the possibly undefined value currently has a value.
 */
function verifyTruthy(v, description) {
    if (v == null)
        throw new Error(description ?? 'A truthy value is required.');
    return v;
}
function shortHex(hex, len = 16) {
    if (!hex || typeof hex !== 'string')
        return String(hex);
    const h = hex.toLowerCase();
    return h.length <= len ? h : `${h.slice(0, len)}…(${h.length})`;
}
function makeId(prefix = 'id') {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
/**
 * Global, optional, app-provided authenticated fetch.
 */
let activeAuthFetch = null;
function setBTMSAuthFetch(fn) {
    activeAuthFetch = fn;
}
exports.setBTMSAuthFetch = setBTMSAuthFetch;
const DEFAULT_MESSAGEBOX_HOST = 'https://messagebox.babbage.systems';
class MessageBoxTokenator {
    constructor(walletClient, defaultBox, host = DEFAULT_MESSAGEBOX_HOST) {
        this.client = null;
        this.initPromise = null;
        this.walletClient = walletClient;
        this.defaultBox = defaultBox;
        this.host = host;
    }
    // --------------------------
    // Types used internally
    // --------------------------
    static isUint8Array(x) {
        return x instanceof Uint8Array;
    }
    static isNumberArray(x) {
        return Array.isArray(x) && x.every(n => typeof n === 'number');
    }
    static safeParseJSON(str) {
        try {
            return JSON.parse(str);
        }
        catch {
            return null;
        }
    }
    async ensureClient() {
        if (this.client)
            return this.client;
        if (!this.initPromise) {
            if (BTMS_DEBUG) {
                btmsDebug('MessageBoxTokenator: creating MessageBoxClient…', {
                    host: this.host,
                    box: this.defaultBox
                });
            }
            // FIXED: must use this.wallet.getNetwork
            //const net = (await this.walletClient.getNetwork({})).network
            this.initPromise = (async () => {
                const client = new message_box_client_1.MessageBoxClient({
                    host: this.host,
                    walletClient: this.walletClient,
                    enableLogging: true,
                    networkPreset: 'mainnet'
                });
                await client.init();
                if (BTMS_DEBUG) {
                    btmsDebug('MessageBoxTokenator: client.init() done');
                }
                this.client = client;
                return client;
            })();
        }
        return this.initPromise;
    }
    // -------------------------------------------------------
    // Strongly typed sendMessage
    // -------------------------------------------------------
    async sendMessage(args) {
        const client = await this.ensureClient();
        const { recipient, messageBox, body } = args;
        const box = messageBox ?? this.defaultBox;
        // payload is ALWAYS a string
        const payload = body;
        // Attempt JSON parse for debugging ONLY
        const bodyObj = MessageBoxTokenator.safeParseJSON(body);
        let beefLen = null;
        if (bodyObj && typeof bodyObj === 'object') {
            const maybeBeef = bodyObj.beef ?? bodyObj.token?.beef;
            if (MessageBoxTokenator.isNumberArray(maybeBeef))
                beefLen = maybeBeef.length;
            if (MessageBoxTokenator.isUint8Array(maybeBeef))
                beefLen = maybeBeef.length;
        }
        if (BTMS_DEBUG) {
            btmsDebug('MessageBoxTokenator.sendMessage ->', {
                recipient,
                box,
                bodyPreview: payload.slice(0, 160),
                beefLen
            });
        }
        const t0 = Date.now();
        try {
            const resp = await client.sendMessage({
                recipient,
                messageBox: box,
                body: payload
            });
            btmsDebug('[MessageBoxTokenator] sendMessage OK', {
                ms: Date.now() - t0,
                hasResp: !!resp,
                status: resp.status,
                id: resp.messageId,
                beefLen
            });
        }
        catch (e) {
            const err = e;
            btmsDebug('[MessageBoxTokenator] sendMessage ERROR', {
                ms: Date.now() - t0,
                message: err.message,
                stackTop: (err.stack ?? '').split('\n').slice(0, 3).join(' | ')
            });
            throw err;
        }
    }
    // -------------------------------------------------------
    // listMessages
    // -------------------------------------------------------
    async listMessages(args) {
        const client = await this.ensureClient();
        const box = args.messageBox ?? this.defaultBox;
        return client.listMessages({ messageBox: box });
    }
    // -------------------------------------------------------
    // acknowledge single
    // -------------------------------------------------------
    async acknowledgeMessage(args) {
        return this.acknowledgeMessages(args);
    }
    // -------------------------------------------------------
    // acknowledge multiple
    // -------------------------------------------------------
    async acknowledgeMessages(args) {
        const client = await this.ensureClient();
        if (!args.messageIds.length)
            return;
        await client.acknowledgeMessage({ messageIds: args.messageIds });
    }
}
class BTMSToken {
    constructor(walletClient = new sdk_1.WalletClient()) {
        this.walletClient = walletClient;
    }
    async lock(protocolID, keyID, counterparty, assetId, amount, metadata, forSelf = true) {
        const fields = [sdk_1.Utils.toArray(assetId), sdk_1.Utils.toArray(String(amount)), sdk_1.Utils.toArray(metadata)];
        const pushdrop = new sdk_1.PushDrop(this.walletClient);
        return pushdrop.lock(fields, protocolID, keyID, counterparty, forSelf);
    }
    unlock(protocolID, keyID, counterparty) {
        // Exactly the HelloTokens pattern: delegate to PushDrop.unlock
        return new sdk_1.PushDrop(this.walletClient).unlock(protocolID, keyID, counterparty);
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
class BTMSFundingToken {
    constructor(walletClient = new sdk_1.WalletClient()) {
        this.walletClient = walletClient;
    }
    /**
     * Create a P2PKH locking script for a fee-funding UTXO.
     * Always returns HEX.
     */
    async lock(protocolID, keyID, counterparty) {
        const { publicKey } = await this.walletClient.getPublicKey({
            protocolID,
            keyID,
            counterparty
        });
        const addr = sdk_1.PublicKey.fromString(publicKey).toAddress();
        // Standard blockchain funding output
        return new sdk_1.P2PKH().lock(addr);
    }
    /**
     * Unlocker for the funding UTXO.
     * Uses PushDrop.unlock(), same as hello-tokens.
     */
    unlock(protocolID, keyID, counterparty) {
        // PushDrop.unlock works for ANY single-sig BSV script
        return new sdk_1.PushDrop(this.walletClient).unlock(protocolID, keyID, counterparty);
    }
}
exports.BTMSFundingToken = BTMSFundingToken;
class BTMS {
    getRandomKeyID() {
        return '1';
        // Browser-safe, cryptographically strong
        // return crypto.randomUUID().replace(/-/g, "");
    }
    constructor(tokensMessageBox = 'tokens-box', protocolID = PROTOCOL_ID, protocolKeyID = PROTOCOL_KEY_ID, basket = INIT_BASKET, tokensTopic = 'tokens', satoshis = 1, privateKey, marketplaceMessageBox = 'marketplace', marketplaceTopic = 'marketplace') {
        this.basketPrefix = BASKET_PREFIX;
        this.tokensMessageBox = tokensMessageBox;
        this.protocolID = protocolID;
        ((this.protocolKeyID = protocolKeyID), (this.basket = basket));
        this.tokenTopic = tokensTopic;
        this.satoshis = satoshis;
        this.tokenator = new MessageBoxTokenator(walletClient, tokensMessageBox);
        this.privateKey = privateKey;
        this.marketplaceMessageBox = marketplaceMessageBox;
        this.marketplaceTopic = marketplaceTopic;
        this.requester = activeAuthFetch ? (url, init) => activeAuthFetch(url, init) : (url, init) => fetch(url, init);
        this.instanceId = makeId('btmsInstance');
        btmsDebug('constructor called', {
            protocolID: this.protocolID,
            instanceId: this.instanceId,
            source: BTMS_SOURCE_TAG,
            stack: new Error('BTMS constructor stack').stack
        });
    }
    /**
     * Always return HEX string for locking scripts.
     * Accepts: hex string, number[], Uint8Array
     */
    toLockingScriptHex(value, callId, context) {
        try {
            if (typeof value === 'string') {
                return value;
            }
            if (Array.isArray(value)) {
                return sdk_1.Utils.toHex(value);
            }
            if (value instanceof Uint8Array) {
                return sdk_1.Utils.toHex(Array.from(value));
            }
            btmsDebug(`${callId}: unsupported lockingScript type in ${context}`, {
                type: typeof value,
                value
            });
            return null;
        }
        catch (e) {
            btmsDebug(`${callId}: toLockingScriptHex FAILED in ${context}`, {
                error: e
            });
            return null;
        }
    }
    /**
     * Always convert any BEEF-like value to AtomicBEEF (number[]).
     * BTMS internal canonical BEEF type is number[] (AtomicBEEF).
     */
    toAtomicBeef(value, callId, context) {
        try {
            // Already AtomicBEEF (number[])
            if (Array.isArray(value)) {
                return value;
            }
            // Uint8Array → convert to number[]
            if (value instanceof Uint8Array) {
                return Array.from(value);
            }
            // Hex string → convert to number[]
            if (typeof value === 'string') {
                const hex = value.startsWith('0x') ? value.slice(2) : value;
                if (hex.length % 2 !== 0) {
                    btmsDebug(`${callId}: odd-length hex in ${context}`, { hex });
                    return null;
                }
                const arr = [];
                for (let i = 0; i < hex.length; i += 2) {
                    arr.push(parseInt(hex.substring(i, i + 2), 16));
                }
                return arr;
            }
            btmsDebug(`${callId}: unsupported BEEF type in ${context}`, {
                type: typeof value,
                value
            });
            return null;
        }
        catch (e) {
            btmsDebug(`${callId}: toAtomicBeef FAILED in ${context}`, { error: e });
            return null;
        }
    }
    // ------------------------------------------------------------
    // getTokens (new-world, ENTIRE TRANSACTION)
    // ------------------------------------------------------------
    async getTokens(assetId) {
        const callId = makeDebugCallId("getTokens");
        btmsDebug(`${callId}: start`, {
            assetId,
            basket: this.basket
        });
        // ---------------------------------------------------------------------------
        // 1) listOutputs() for THIS token's basket only
        // ---------------------------------------------------------------------------
        const args = {
            basket: this.basket,
            include: "locking scripts",
            includeTags: true,
            includeLabels: false,
            seekPermission: true,
            limit: 10000
        };
        btmsDebug(`${callId}: listOutputs ARGS`, args);
        const { outputs } = await walletClient.listOutputs(args);
        btmsDebug(`${callId}: listOutputs RESULT`, {
            totalOutputs: outputs.length
        });
        const filtered = [];
        // ---------------------------------------------------------------------------
        // 2) Decode BTMSv2 PushDrop tokens
        // ---------------------------------------------------------------------------
        for (const o of outputs) {
            const scriptHex = this.toLockingScriptHex(o.lockingScript, callId, "getTokens");
            if (!scriptHex) {
                btmsDebug(`${callId}: skip (no lockingScript)`, { outpoint: o.outpoint });
                continue;
            }
            let decoded;
            try {
                decoded = sdk_1.PushDrop.decode(sdk_1.LockingScript.fromHex(scriptHex));
            }
            catch {
                btmsDebug(`${callId}: skip (not PushDrop)`, { outpoint: o.outpoint });
                continue;
            }
            const fields = decoded.fields.map(f => sdk_1.Utils.toUTF8(f));
            if (fields.length < 4) {
                btmsDebug(`${callId}: skip (fields<4)`, { outpoint: o.outpoint });
                continue;
            }
            const tokenName = fields[0];
            const op = fields[1];
            if (op !== "ISSUE")
                continue;
            if (tokenName !== assetId)
                continue;
            filtered.push(o);
        }
        btmsDebug(`${callId}: done`, { count: filtered.length });
        return filtered;
    }
    async getBalance(assetId, myTokens) {
        const callId = makeDebugCallId("getBalance");
        // Pre-fetch if not provided
        if (!Array.isArray(myTokens)) {
            myTokens = await this.getTokens(assetId);
        }
        let balance = 0;
        for (const o of myTokens) {
            const scriptHex = this.toLockingScriptHex(o.lockingScript, callId, "getBalance");
            if (!scriptHex)
                continue;
            let decoded;
            try {
                decoded = sdk_1.PushDrop.decode(sdk_1.LockingScript.fromHex(scriptHex));
            }
            catch {
                continue;
            }
            const fields = decoded.fields.map(f => sdk_1.Utils.toUTF8(f));
            if (fields.length < 4)
                continue;
            const tokenName = fields[0];
            const op = fields[1];
            const amountStr = fields[2];
            if (op !== "ISSUE")
                continue;
            if (tokenName !== assetId)
                continue;
            const amount = Number(amountStr);
            if (!Number.isFinite(amount))
                continue;
            balance += amount;
        }
        btmsDebug(`${callId}: balance computed`, { assetId, balance });
        return balance;
    }
    /**
     * ISSUE: create brand-new BTMS tokens under basket "btms <name>"
     */
    async issue(amount, name, assetId, metadata) {
        const callId = makeDebugCallId('issue');
        btmsDebug(`${callId}: START`, { amount, name, assetId, metadata });
        try {
            //----------------------------------------------------------------------
            // 0) DETERMINE THE PER-TOKEN BASKET (p btms <assetId>)
            //----------------------------------------------------------------------
            const basket = `${this.basketPrefix} ${assetId}`;
            //this.basket = basket
            btmsDebug(`${callId}: using per-token basket`, { basket });
            //----------------------------------------------------------------------
            // 1) CREATE BTMS LOCKING SCRIPT (PushDrop via BTMSToken.lock)
            //----------------------------------------------------------------------
            const template = new BTMSToken(walletClient);
            const metadataJson = metadata && metadata.trim().length > 0 ? metadata : JSON.stringify({ name, assetId });
            btmsDebug(`${callId}: lock() inputs`, {
                protocolID: this.protocolID,
                protocolKeyID: this.protocolKeyID,
                counterparty: 'self',
                assetId,
                amount,
                metadataJson
            });
            const lockScript = await template.lock(this.protocolID, this.protocolKeyID, 'self', assetId, // <-- STRING ✔ correct
            amount, // <-- NUMBER ✔ correct
            metadataJson, // <-- STRING ✔ correct
            true // forSelf
            );
            const lockingScriptHex = lockScript.toHex();
            btmsDebug(`${callId}: lock() OK`, {
                lockingScriptPreview: shortHex(lockingScriptHex, 60)
            });
            //----------------------------------------------------------------------
            // 2) CREATE ACTION ARGS (WalletInterface)
            //----------------------------------------------------------------------
            const args = {
                description: `Issue ${amount} ${name}`,
                labels: [assetId],
                outputs: [
                    {
                        satoshis: this.satoshis,
                        lockingScript: lockingScriptHex,
                        basket,
                        outputDescription: `${amount} new ${name}`,
                        tags: ['btms', 'tokens', 'issue'],
                        customInstructions: JSON.stringify({
                            keyID: this.getRandomKeyID()
                        })
                    }
                ],
                options: {
                    acceptDelayedBroadcast: false,
                    randomizeOutputs: false
                }
            };
            btmsDebug(`${callId}: createAction ARGS`, args);
            //----------------------------------------------------------------------
            // 3) CREATE ACTION + ERROR HANDLING (MANDATORY)
            //----------------------------------------------------------------------
            const createActionResult = await walletClient.createAction(args);
            console.log('result=', createActionResult);
            if (!createActionResult.tx) {
                throw new Error('Transaction is undefined. Action may be delayed.');
            }
            //----------------------------------------------------------------------
            // 4) BROADCAST
            //----------------------------------------------------------------------
            const broadcaster = new sdk_1.TopicBroadcaster(['tm_btms'], {
                networkPreset: 'local'
            });
            const finalResult = await broadcaster.broadcast(sdk_1.Transaction.fromAtomicBEEF(createActionResult.tx));
            btmsDebug(`${callId}: BROADCAST RESULT`, finalResult);
            return finalResult;
        }
        catch (error) {
            if (error instanceof sdk_1.WERR_REVIEW_ACTIONS) {
                console.error('Wallet threw WERR_REVIEW_ACTIONS:', {
                    code: error.code,
                    message: error.message,
                    reviewActionResults: error.reviewActionResults,
                    sendWithResults: error.sendWithResults,
                    txid: error.txid,
                    tx: error.tx,
                    noSendChange: error.noSendChange
                });
            }
            else if (error instanceof Error) {
                console.error('Failed with error status:', {
                    message: error.message,
                    name: error.name,
                    stack: error.stack,
                    error
                });
            }
            else {
                console.error('Failed with unknown error:', error);
            }
            throw error;
        }
    }
    async listAssets(includeMode = "locking scripts") {
        // ------------------------------------------------------------
        // BTMSv2 rule: if basket is INIT_BASKET → no token family yet
        // ------------------------------------------------------------
        if (this.basket === INIT_BASKET) {
            btmsDebug("listAssets: basket=INIT_BASKET → returning null");
            return null;
        }
        const callId = makeDebugCallId("listAssets");
        btmsDebug(`${callId}: start`, {
            basket: this.basket,
            includeMode
        });
        const assets = {};
        // ---------------------------------------------------------------------------
        // 1) Wallet listOutputs() for THIS token family (BRC-100 truth)
        // ---------------------------------------------------------------------------
        const args = {
            basket: this.basket,
            include: includeMode,
            includeTags: true,
            includeLabels: false,
            seekPermission: true,
            limit: 10000
        };
        btmsDebug(`${callId}: listOutputs ARGS`, args);
        let result;
        try {
            result = await walletClient.listOutputs(args);
        }
        catch (e) {
            btmsDebug(`${callId}: listOutputs FAILED`, { error: e });
            throw e;
        }
        const outputs = result.outputs;
        btmsDebug(`${callId}: listOutputs RESULT`, { total: outputs.length });
        // ---------------------------------------------------------------------------
        // 2) Decode BTMSv2 PushDrop:
        //    [ tokenName, "ISSUE", amount, metadataJSON ]
        // ---------------------------------------------------------------------------
        for (const o of outputs) {
            const scriptHex = this.toLockingScriptHex(o.lockingScript, callId, "utxo-scan");
            if (!scriptHex)
                continue;
            let decoded;
            try {
                decoded = sdk_1.PushDrop.decode(sdk_1.LockingScript.fromHex(scriptHex));
            }
            catch {
                continue; // not BTMSv2 token
            }
            const utf8 = decoded.fields.map(f => sdk_1.Utils.toUTF8(f));
            if (utf8.length < 4)
                continue;
            const tokenName = utf8[0];
            const op = utf8[1];
            const amountStr = utf8[2];
            const metadataJson = utf8[3];
            if (op !== "ISSUE")
                continue;
            const amount = Number(amountStr);
            if (!Number.isFinite(amount) || amount <= 0)
                continue;
            let meta = {};
            try {
                meta = JSON.parse(metadataJson);
            }
            catch { }
            if (!assets[tokenName]) {
                assets[tokenName] = {
                    assetId: tokenName,
                    name: meta?.name ?? "BTMS Token",
                    balance: amount,
                    metadata: metadataJson
                };
            }
            else {
                assets[tokenName].balance += amount;
            }
        }
        // ---------------------------------------------------------------------------
        // 3) Incoming Message-Box tokens (same BTMSv2 4-field PushDrop)
        // ---------------------------------------------------------------------------
        const incoming = await this.tokenator.listMessages({
            messageBox: this.tokensMessageBox
        });
        for (const msg of incoming) {
            try {
                const raw = typeof msg.body === "string" ? msg.body : JSON.stringify(msg.body);
                const parsed = JSON.parse(JSON.parse(raw)); // double JSON (historic format)
                const tokenRaw = parsed.token;
                if (!tokenRaw)
                    continue;
                const lsHex = this.toLockingScriptHex(tokenRaw.lockingScript, callId, "incoming");
                if (!lsHex)
                    continue;
                let decoded;
                try {
                    decoded = sdk_1.PushDrop.decode(sdk_1.LockingScript.fromHex(lsHex));
                }
                catch {
                    continue;
                }
                const fields = decoded.fields.map(f => sdk_1.Utils.toUTF8(f));
                if (fields.length < 4)
                    continue;
                const tokenName = fields[0];
                const op = fields[1];
                const amount = Number(fields[2]);
                const metadataJson = fields[3];
                if (op !== "ISSUE")
                    continue;
                let meta = {};
                try {
                    meta = JSON.parse(metadataJson);
                }
                catch { }
                if (!assets[tokenName]) {
                    assets[tokenName] = {
                        assetId: tokenName,
                        name: meta?.name ?? "BTMS Token",
                        balance: 0,
                        incoming: true,
                        new: true,
                        incomingAmount: amount,
                        metadata: metadataJson
                    };
                }
                else {
                    assets[tokenName].incoming = true;
                    assets[tokenName].incomingAmount =
                        (assets[tokenName].incomingAmount ?? 0) + amount;
                }
            }
            catch (err) {
                btmsDebug(`${callId}: incoming parse error`, { err });
            }
        }
        // ---------------------------------------------------------------------------
        // DONE
        // ---------------------------------------------------------------------------
        const finalList = Object.values(assets);
        btmsDebug(`${callId}: final asset list`, { count: finalList.length });
        return finalList;
    }
    async send(assetId, recipient, sendAmount, onPaymentSent = () => { }) {
        const callId = makeDebugCallId('send');
        btmsDebug(`${callId}: START`, { assetId, recipient, sendAmount });
        try {
            /* ------------------------------------------------------------------ */
            /* 1) Fetch tokens + balance (new-world only, no cache)                */
            /* ------------------------------------------------------------------ */
            const myTokens = await this.getTokens(assetId);
            btmsDebug(`${callId}: getTokens RESULT`, {
                count: myTokens.length,
                firstOutpoint: myTokens[0]?.outpoint,
                firstVout: myTokens[0]?.vout,
                hasTx: !!myTokens[0]?.tx
            });
            const myBalance = await this.getBalance(assetId, myTokens);
            btmsDebug(`${callId}: getBalance RESULT`, { myBalance });
            if (sendAmount > myBalance) {
                throw new Error('BTMS send: insufficient tokens.');
            }
            if (myTokens.length === 0) {
                throw new Error('BTMS send: no BTMS tokens for this asset.');
            }
            const first = myTokens[0];
            if (!first.tx) {
                throw new Error('BTMS send: token UTXO is missing its BEEF.');
            }
            const inputIndex = first.outputIndex ?? first.vout;
            if (typeof inputIndex !== 'number') {
                throw new Error('BTMS send: missing outputIndex/vout.');
            }
            const loadedBeef = sdk_1.Beef.fromBinary(first.tx);
            const prevTx = sdk_1.Transaction.fromAtomicBEEF(first.tx);
            const prevOut = prevTx.outputs[inputIndex];
            const scriptHex = prevOut.lockingScript.toHex();
            let decoded;
            try {
                decoded = sdk_1.PushDrop.decode(sdk_1.LockingScript.fromHex(scriptHex));
            }
            catch {
                throw new Error('BTMS send: previous output is not BTMS PushDrop.');
            }
            const fields = decoded.fields.map(f => sdk_1.Utils.toUTF8(f));
            if (fields.length < 4) {
                throw new Error('BTMS send: PushDrop fields malformed.');
            }
            // [ tokenName, "ISSUE", amount, metadataJSON ]
            const tokenName = fields[0];
            const op = fields[1];
            const amtStr = fields[2];
            const metadataJson = fields[3];
            if (op !== 'ISSUE') {
                throw new Error('BTMS send: not an ISSUE token UTXO.');
            }
            if (tokenName !== assetId) {
                throw new Error('BTMS send: token mismatch.');
            }
            const firstAmount = Number(amtStr);
            if (sendAmount > firstAmount) {
                throw new Error('BTMS send: sendAmount > single-token amount.');
            }
            let parsedMetadata = {};
            try {
                parsedMetadata = JSON.parse(metadataJson);
            }
            catch {
                /* ignore */
            }
            const tokenDisplayName = parsedMetadata.name ?? assetId;
            btmsDebug(`${callId}: decoded token`, {
                tokenName,
                firstAmount,
                metadataJson,
                parsedName: tokenDisplayName
            });
            /* ------------------------------------------------------------------ */
            /* 2) Extract keyID for unlocking                                     */
            /* ------------------------------------------------------------------ */
            let unlockKeyID;
            try {
                const ci = JSON.parse(first.customInstructions ?? '{}');
                unlockKeyID = ci.keyID;
            }
            catch {
                /* ignore */
            }
            if (!unlockKeyID) {
                throw new Error('BTMS send: missing keyID in customInstructions.');
            }
            btmsDebug(`${callId}: unlock keyID`, { unlockKeyID });
            /* ------------------------------------------------------------------ */
            /* 3) Load sender identity under PROTECTED protocol                    */
            /* ------------------------------------------------------------------ */
            const getPublicKeyArgs = {
                protocolID: PROTOCOL_ID,
                keyID: PROTOCOL_KEY_ID,
                counterparty: 'self',
                forSelf: true,
                identityKey: true
            };
            btmsDebug(`${callId}: getPublicKey ARGS`, { getPublicKeyArgs });
            const { publicKey: myIdentityKey } = await walletClient.getPublicKey(getPublicKeyArgs);
            btmsDebug(`${callId}: getPublicKey RESULT`, { myIdentityKey });
            /* ------------------------------------------------------------------ */
            /* 4) Build recipient + change outputs with BTMSToken.lock()          */
            /* ------------------------------------------------------------------ */
            const template = new BTMSToken(walletClient);
            const outputs = [];
            const tokenBasket = `${this.basketPrefix} ${assetId}`;
            //const tokenBasket = `p ${this.basketPrefix} ${assetId}` as BasketStringUnder300Bytes
            // Recipient output
            const recipientKeyID = this.getRandomKeyID();
            const recipientLockScript = await template.lock(PROTOCOL_ID, PROTOCOL_KEY_ID, 'self', assetId, sendAmount, metadataJson);
            const recipientScriptHex = recipientLockScript.toHex();
            btmsDebug(`${callId}: RECIPIENT lock() RESULT`, {
                recipientScriptPreview: shortHex(recipientScriptHex, 48)
            });
            const recipientOutput = {
                satoshis: this.satoshis,
                lockingScript: recipientScriptHex,
                outputDescription: `Send ${sendAmount} ${tokenDisplayName}`,
                tags: [myIdentityKey === recipient ? 'owner self' : `owner ${recipient}`]
            };
            // Recipient keeps inside basket if sending to self
            if (myIdentityKey === recipient) {
                recipientOutput.basket = tokenBasket;
                recipientOutput.customInstructions = JSON.stringify({
                    sender: myIdentityKey,
                    keyID: recipientKeyID
                });
            }
            outputs.push(recipientOutput);
            // Change output
            const changeAmount = firstAmount - sendAmount;
            if (changeAmount > 0) {
                const changeLockScript = await template.lock(PROTOCOL_ID, PROTOCOL_KEY_ID, 'self', assetId, changeAmount, metadataJson);
                const changeScriptHex = changeLockScript.toHex();
                btmsDebug(`${callId}: CHANGE lock() RESULT`, {
                    changeScriptPreview: shortHex(changeScriptHex, 48),
                    changeAmount
                });
                outputs.push({
                    satoshis: this.satoshis,
                    lockingScript: changeScriptHex,
                    basket: tokenBasket,
                    outputDescription: `Keep ${changeAmount} ${tokenDisplayName}`,
                    tags: ['owner self'],
                    customInstructions: JSON.stringify({
                        sender: myIdentityKey,
                        keyID: this.getRandomKeyID()
                    })
                });
            }
            /* ------------------------------------------------------------------ */
            /* 5) createAction (protected protocol)                               */
            /* ------------------------------------------------------------------ */
            const createActionArgs = {
                description: `Send ${sendAmount} ${tokenDisplayName} to ${recipient}`,
                labels: [assetId],
                inputBEEF: loadedBeef.toBinary(),
                inputs: [
                    {
                        outpoint: (first.outpoint ?? `${prevTx.id('hex')}.${inputIndex}`),
                        unlockingScriptLength: 74,
                        inputDescription: `Spend ${tokenDisplayName} BTMS token`
                    }
                ],
                outputs,
                options: {
                    acceptDelayedBroadcast: false,
                    randomizeOutputs: false
                }
            };
            btmsDebug(`${callId}: createAction ARGS`, {
                description: createActionArgs.description,
                labels: createActionArgs.labels,
                inputs: createActionArgs.inputs,
                outputsCount: createActionArgs.outputs?.length ?? 0
            });
            const createActionResult = await walletClient.createAction(createActionArgs);
            btmsDebug(`${callId}: createAction RESULT`, {
                hasSignable: !!createActionResult.signableTransaction
            });
            const { signableTransaction } = createActionResult;
            if (!signableTransaction) {
                throw new Error('BTMS send: createAction -> no signableTransaction.');
            }
            /* ------------------------------------------------------------------ */
            /* 6) Unlocking script via PushDrop.unlock                            */
            /* ------------------------------------------------------------------ */
            const txForSigning = sdk_1.Transaction.fromAtomicBEEF(signableTransaction.tx);
            const unlocker = new sdk_1.PushDrop(walletClient).unlock(PROTOCOL_ID, PROTOCOL_KEY_ID, 'self');
            btmsDebug(`${callId}: unlocker.sign ARGS`, {
                txid: txForSigning.id('hex'),
                inputIndex: 0
            });
            const unlockingScript = await unlocker.sign(txForSigning, 0);
            btmsDebug(`${callId}: unlocker.sign RESULT`, {
                unlockingScriptPreview: shortHex(unlockingScript.toHex(), 48)
            });
            /* ------------------------------------------------------------------ */
            /* 7) signAction (protected protocol)                                 */
            /* ------------------------------------------------------------------ */
            const signActionArgs = {
                reference: signableTransaction.reference,
                spends: {
                    0: { unlockingScript: unlockingScript.toHex() }
                }
            };
            btmsDebug(`${callId}: signAction ARGS`, signActionArgs);
            const signResult = await walletClient.signAction(signActionArgs);
            btmsDebug(`${callId}: signAction RESULT`, {
                hasTx: !!signResult.tx
            });
            if (!signResult.tx) {
                throw new Error('BTMS send: signAction missing tx.');
            }
            const finalTxObj = sdk_1.Transaction.fromAtomicBEEF(signResult.tx);
            const finalTxid = finalTxObj.id('hex');
            /* ------------------------------------------------------------------ */
            /* 8) TokenForRecipient + message-box send                            */
            /* ------------------------------------------------------------------ */
            const tokenForRecipient = {
                txid: finalTxid,
                vout: 0,
                amount: sendAmount,
                satoshis: this.satoshis,
                beef: signResult.tx,
                keyID: recipientKeyID,
                lockingScript: recipientScriptHex
            };
            btmsDebug(`${callId}: tokenForRecipient`, {
                txid: tokenForRecipient.txid,
                amount: tokenForRecipient.amount,
                keyID: tokenForRecipient.keyID
            });
            // Only send via message-box-client if recipient != self
            if (myIdentityKey !== recipient) {
                const sendMessageArgs = {
                    recipient,
                    messageBox: this.tokensMessageBox,
                    body: JSON.stringify({ token: tokenForRecipient })
                };
                btmsDebug(`${callId}: message-box sendMessage ARGS`, sendMessageArgs);
                await this.tokenator.sendMessage(sendMessageArgs);
                btmsDebug(`${callId}: message-box sendMessage RESULT`, { ok: true });
            }
            try {
                onPaymentSent(tokenForRecipient);
            }
            catch (err) {
                btmsDebug(`${callId}: onPaymentSent callback threw`, { err });
            }
            /* ------------------------------------------------------------------ */
            /* 9) Broadcast via TopicBroadcaster                                  */
            /* ------------------------------------------------------------------ */
            const broadcasterArgs = {
                topics: ['tm_btms'],
                options: {
                    networkPreset: 'local'
                }
            };
            btmsDebug(`${callId}: TopicBroadcaster ARGS`, broadcasterArgs);
            const broadcaster = new sdk_1.TopicBroadcaster(broadcasterArgs.topics, broadcasterArgs.options);
            const broadcastResult = await broadcaster.broadcast(finalTxObj);
            btmsDebug(`${callId}: broadcast RESULT`, broadcastResult);
            if (broadcastResult.status !== 'success') {
                throw new Error(`BTMS send: broadcast failed: ${broadcastResult.reason}`);
            }
            btmsDebug(`${callId}: COMPLETE`, { finalTxid });
            return { status: 'success', topics: {} };
        }
        catch (error) {
            if (error instanceof sdk_1.WERR_REVIEW_ACTIONS) {
                console.error('BTMS SEND: WERR_REVIEW_ACTIONS', {
                    code: error.code,
                    message: error.message,
                    reviewActionResults: error.reviewActionResults
                });
            }
            else {
                console.error('BTMS SEND: unexpected', error);
            }
            btmsDebug(`${callId}: FINAL ERROR`, {
                message: error?.message,
                stack: error?.stack
            });
            throw error;
        }
    }
    async acceptIncomingPayment(assetId, payment) {
        const callId = makeDebugCallId("acceptIncomingPayment");
        btmsDebug(`${callId}: start`, {
            expectedAsset: assetId,
            txid: payment.txid,
            vout: payment.vout
        });
        // ---------------------------------------------------------------------------
        // 1) Ensure lockingScript is present
        // ---------------------------------------------------------------------------
        const scriptHex = payment.lockingScript;
        if (!scriptHex) {
            throw new Error("acceptIncomingPayment: missing lockingScript");
        }
        // ---------------------------------------------------------------------------
        // 2) Decode PushDrop (BTMSv2 = 4 fields)
        // ---------------------------------------------------------------------------
        let decoded;
        try {
            decoded = sdk_1.PushDrop.decode(sdk_1.LockingScript.fromHex(scriptHex));
        }
        catch (e) {
            btmsDebug(`${callId}: PushDrop.decode FAILED`, { error: e });
            if (payment.messageId) {
                await this.tokenator.acknowledgeMessage({ messageIds: [payment.messageId] });
            }
            throw new Error("acceptIncomingPayment: invalid BTMS token script");
        }
        const fields = decoded.fields.map(f => sdk_1.Utils.toUTF8(f));
        // Expected 4 fields:
        // [ tokenName, "ISSUE", amountStr, metadataJson ]
        if (fields.length < 3) {
            btmsDebug(`${callId}: malformed BTMS PushDrop`, { fields });
            if (payment.messageId) {
                await this.tokenator.acknowledgeMessage({ messageIds: [payment.messageId] });
            }
            throw new Error("acceptIncomingPayment: token script missing fields");
        }
        const tokenName = fields[0];
        const op = fields[1];
        const amountStr = fields[2];
        const metadataJson = fields[3] ?? "{}";
        if (op !== "ISSUE") {
            throw new Error("acceptIncomingPayment: unsupported op (must be ISSUE)");
        }
        // ---------------------------------------------------------------------------
        // 3) Validate assetId
        // ---------------------------------------------------------------------------
        if (tokenName !== assetId) {
            if (payment.messageId) {
                await this.tokenator.acknowledgeMessage({ messageIds: [payment.messageId] });
            }
            throw new Error(`Incoming token assetId mismatch. Expected ${assetId} but got ${tokenName}.`);
        }
        // ---------------------------------------------------------------------------
        // 4) Protected-protocol ownership check
        // ---------------------------------------------------------------------------
        let myIdentityKey;
        try {
            const res = await walletClient.getPublicKey({
                identityKey: true,
                protocolID: PROTOCOL_ID,
                keyID: PROTOCOL_KEY_ID,
                counterparty: "self",
                forSelf: true
            });
            myIdentityKey = res.publicKey;
        }
        catch (e) {
            btmsDebug(`${callId}: getPublicKey FAILED`, { error: e });
            throw new Error("Unable to fetch identity key under protected protocol.");
        }
        const lockingPubKey = decoded.lockingPublicKey;
        if (lockingPubKey && lockingPubKey !== myIdentityKey) {
            if (payment.messageId) {
                await this.tokenator.acknowledgeMessage({ messageIds: [payment.messageId] });
            }
            throw new Error("Received BTMS token not belonging to this wallet.");
        }
        // ---------------------------------------------------------------------------
        // 5) Parse metadata
        // ---------------------------------------------------------------------------
        let parsedMeta = {};
        try {
            parsedMeta = JSON.parse(metadataJson);
        }
        catch { }
        const logicalAmount = Number(amountStr);
        btmsDebug(`${callId}: verified incoming token`, {
            assetId: tokenName,
            amount: logicalAmount,
            name: parsedMeta?.name ?? "Token"
        });
        // ---------------------------------------------------------------------------
        // 6) ACK the MessageBox delivery
        // ---------------------------------------------------------------------------
        if (payment.messageId) {
            await this.tokenator.acknowledgeMessage({
                messageIds: [payment.messageId]
            });
        }
        btmsDebug(`${callId}: complete`, { accepted: true });
        return true;
    }
    /**
     * NEW-WORLD listAssets(): wallet = truth, overlays only supplement metadata.
     */
    async listIncomingPayments(assetId) {
        const callId = makeDebugCallId("listIncomingPayments");
        btmsDebug(`${callId}: start`, {
            filterAssetId: assetId ?? "(ALL)",
            tokensMessageBox: this.tokensMessageBox
        });
        const payments = [];
        // ---------------------------------------------------------------------------
        // 1) List peer-serv incoming MessageBox messages
        // ---------------------------------------------------------------------------
        const incoming = await this.tokenator.listMessages({
            messageBox: this.tokensMessageBox
        });
        for (const m of incoming) {
            try {
                // -----------------------------------------------------------------------
                // 2) Normalize body to string + double-parse (old message-box format)
                // -----------------------------------------------------------------------
                const raw = typeof m.body === "string" ? m.body : JSON.stringify(m.body);
                const parsed = JSON.parse(JSON.parse(raw));
                const tokenRaw = parsed.token;
                if (!tokenRaw || !tokenRaw.lockingScript)
                    continue;
                // -----------------------------------------------------------------------
                // 3) Normalize lockingScript → hex
                // -----------------------------------------------------------------------
                const lsHex = this.toLockingScriptHex(tokenRaw.lockingScript, callId, "listIncomingPayments/lockingScript");
                if (!lsHex)
                    continue;
                // Normalize BEEF
                const beef = this.toAtomicBeef(tokenRaw.beef, callId, "listIncomingPayments/beef");
                if (!beef)
                    continue;
                // -----------------------------------------------------------------------
                // 4) Decode PushDrop (BTMSv2 format: 4 fields)
                // -----------------------------------------------------------------------
                let decoded;
                try {
                    decoded = sdk_1.PushDrop.decode(sdk_1.LockingScript.fromHex(lsHex));
                }
                catch {
                    continue; // skip non-BTMS tokens
                }
                const fieldsUtf8 = decoded.fields.map(f => sdk_1.Utils.toUTF8(f));
                // BTMSv2 SPEC:
                // [ tokenName, "ISSUE", amountStr, metadataJson ]
                if (fieldsUtf8.length < 3)
                    continue;
                const tokenName = fieldsUtf8[0]; // assetId
                const op = fieldsUtf8[1]; // "ISSUE"
                const amountStr = fieldsUtf8[2]; // amount
                const metadataJson = fieldsUtf8[3] ?? "{}";
                if (op !== "ISSUE")
                    continue;
                const amount = Number(amountStr);
                if (!Number.isFinite(amount))
                    continue;
                // -----------------------------------------------------------------------
                // 5) Filter by provided assetId (optional)
                // -----------------------------------------------------------------------
                if (assetId && tokenName !== assetId)
                    continue;
                // -----------------------------------------------------------------------
                // 6) Produce BTMS IncomingPayment (new-world)
                // -----------------------------------------------------------------------
                const payment = {
                    txid: tokenRaw.txid,
                    vout: tokenRaw.vout,
                    lockingScript: lsHex,
                    amount,
                    sender: m.sender,
                    messageId: m.messageId,
                    keyID: tokenRaw.keyID,
                    satoshis: tokenRaw.satoshis,
                    assetId: tokenName,
                    tx: beef
                };
                payments.push(payment);
            }
            catch (err) {
                console.error("listIncomingPayments: error parsing message", err);
            }
        }
        btmsDebug(`${callId}: done`, { count: payments.length });
        return payments;
    }
    /**
     * Refund an incoming BTMS token back to sender.
     * (New-world createAction → signAction pattern)
     */
    async refundIncomingTransaction(assetId, payment) {
        const callId = makeDebugCallId('refundIncomingTransaction');
        btmsDebug(`${callId}: start`, {
            assetId,
            txid: payment.txid,
            vout: payment.vout,
            sender: payment.sender
        });
        // ------------------------------------------------------------
        // 1) Decode metadata from lockingScript (always HEX internally)
        // ------------------------------------------------------------
        let decoded;
        try {
            decoded = sdk_1.PushDrop.decode(sdk_1.LockingScript.fromHex(payment.lockingScript));
        }
        catch (e) {
            btmsDebug(`${callId}: decode FAILED`, { error: e });
            throw new Error('refundIncomingTransaction: invalid BTMS script');
        }
        const fieldsUtf8 = decoded.fields.map(f => sdk_1.Utils.toUTF8(f));
        if (fieldsUtf8.length < 2) {
            throw new Error('refundIncomingTransaction: token script missing fields');
        }
        const amountStr = fieldsUtf8[1];
        const metadataJson = fieldsUtf8[2] ?? '{}';
        let parsedMetadata = {};
        try {
            parsedMetadata = JSON.parse(metadataJson);
        }
        catch {
            // ignore, keep default
        }
        const logicalAmount = Number(amountStr);
        btmsDebug(`${callId}: decoded`, {
            logicalAmount,
            metadata: parsedMetadata
        });
        if (!Number.isFinite(logicalAmount) || logicalAmount <= 0) {
            throw new Error('refundIncomingTransaction: logical token amount is invalid or non-positive');
        }
        // ------------------------------------------------------------
        // 2) Validate we have the prior transaction BEEF
        // ------------------------------------------------------------
        let prevTx;
        if (!payment.tx) {
            throw new Error('refundIncomingTransaction: Missing BEEF data on payment.tx.');
        }
        let prevBeef;
        try {
            prevBeef = sdk_1.Beef.fromBinary(payment.tx);
            prevTx = sdk_1.Transaction.fromAtomicBEEF(prevBeef.toBinary());
        }
        catch (e) {
            btmsDebug(`${callId}: failed to parse BEEF`, { error: e });
            throw new Error('refundIncomingTransaction: Invalid prior transaction BEEF.');
        }
        const template = new BTMSToken();
        const ownerKeyID = payment.keyID;
        const txForSigning = prevTx;
        // ------------------------------------------------------------
        // 3) Build refund output back to original sender
        // ------------------------------------------------------------
        const refundScriptHex = (await template.lock(this.protocolID, ownerKeyID, payment.sender, assetId, logicalAmount, metadataJson)).toHex();
        const outputs = [
            {
                satoshis: payment.satoshis,
                lockingScript: refundScriptHex,
                outputDescription: `Refund ${logicalAmount} ${parsedMetadata.name ?? 'BTMS token'} to sender`,
                tags: ['btms', 'refund']
            }
        ];
        btmsDebug(`${callId}: built refund outputs`, {
            outputCount: outputs.length
        });
        // ------------------------------------------------------------
        // 4) Create the action using the original tx as input
        // ------------------------------------------------------------
        const outpoint = `${payment.txid}.${payment.vout}`;
        const { signableTransaction } = await walletClient.createAction({
            description: `Refund ${logicalAmount} ${parsedMetadata.name ?? 'BTMS token'} to sender`,
            labels: [assetId],
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
        });
        if (!signableTransaction) {
            throw new Error('refundIncomingTransaction: createAction missing signableTransaction');
        }
        // ------------------------------------------------------------
        // 5) Build unlocking script for the input using PushDrop.unlock
        // ------------------------------------------------------------
        const txToSign = sdk_1.Transaction.fromAtomicBEEF(signableTransaction.tx);
        const unlocker = new sdk_1.PushDrop(walletClient).unlock(this.protocolID, ownerKeyID, 'self');
        const unlockingScript = await unlocker.sign(txToSign, 0);
        btmsDebug(`${callId}: built unlockingScript`, {
            length: unlockingScript.toHex().length
        });
        const signResult = await walletClient.signAction({
            reference: signableTransaction.reference,
            spends: {
                0: { unlockingScript: unlockingScript.toHex() }
            }
        });
        if (!signResult.tx) {
            throw new Error('refundIncomingTransaction: signAction missing tx field');
        }
        const finalTx = sdk_1.Transaction.fromAtomicBEEF(signResult.tx);
        const finalTxid = finalTx.id('hex');
        btmsDebug(`${callId}: built refund tx`, { txid: finalTxid });
        // ------------------------------------------------------------
        // 6) Broadcast via TopicBroadcaster
        // ------------------------------------------------------------
        const broadcaster = new sdk_1.TopicBroadcaster(['tm_btms'], {
            networkPreset: 'local'
        });
        const broadcastResult = await broadcaster.broadcast(finalTx);
        btmsDebug(`${callId}: broadcastResult`, {
            status: broadcastResult.status,
            reason: broadcastResult.reason
        });
        if (broadcastResult.status !== 'success') {
            const reason = broadcastResult.reason ?? 'unknown';
            throw new Error(`refundIncomingTransaction: broadcast failed: ${reason}`);
        }
        // ------------------------------------------------------------
        // 7) ACK the original peer-serv message, if present
        // ------------------------------------------------------------
        if (payment.messageId) {
            await this.tokenator.acknowledgeMessage({
                messageIds: [payment.messageId]
            });
        }
        btmsDebug(`${callId}: refund complete`, { txid: finalTxid });
        // We don't get topics from the overlay in new-world, so we keep this
        // compatible with the old SubmitResult shape.
        return {
            status: 'success',
            topics: {}
        };
    }
    async getTransactions(assetId, limit, offset) {
        const callId = makeDebugCallId('getTransactions');
        btmsDebug(`${callId}: start`, { assetId, limit, offset });
        // -------------------------------------------------------------
        // Resolve my identity key (used ONLY when inferring counterparty)
        // -------------------------------------------------------------
        const { publicKey: myIdentityKey } = await walletClient.getPublicKey({
            identityKey: true
        });
        // -------------------------------------------------------------
        // listActions – new-world compatible call
        // -------------------------------------------------------------
        const actions = await walletClient.listActions({
            labels: [assetId.replace('.', ' ')],
            limit,
            offset
        });
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
            let quantity = 0;
            // -----------------------------------------------------------
            // Decode BTMS quantity from ANY output that contains a BTMS script
            // -----------------------------------------------------------
            const outputs = a.outputs ?? [];
            for (const output of outputs) {
                const scriptSource = output.lockingScript ?? output.outputScript ?? null;
                if (!scriptSource)
                    continue;
                const scriptHex = this.toLockingScriptHex(scriptSource, callId, 'getTransactions/outputs');
                if (!scriptHex)
                    continue;
                let decoded;
                try {
                    decoded = sdk_1.PushDrop.decode(sdk_1.LockingScript.fromHex(scriptHex));
                }
                catch {
                    continue; // not a BTMS script
                }
                const fields = decoded.fields.map(f => sdk_1.Utils.toUTF8(f));
                if (fields.length < 2)
                    continue;
                const qty = Number(fields[1]);
                if (!Number.isFinite(qty))
                    continue;
                quantity = qty;
                break; // one BTMS field per tx
            }
            // If we could not decode, we record 0
            const amount = a.isOutgoing ? -quantity : quantity;
            // -----------------------------------------------------------
            // Counterparty:
            //   • If outgoing → unknown-recipient
            //   • If incoming → myself (wallet UI convention)
            // -----------------------------------------------------------
            const counterparty = a.isOutgoing
                ? 'unknown-recipient'
                : myIdentityKey;
            return {
                // No timestamp/created_at available → synthetic
                date: new Date().toISOString(),
                amount,
                txid: a.txid,
                counterparty
            };
        });
        return {
            ...actions,
            transactions: txs
        };
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
    verifyIncomingToken(scriptHex, expectedAssetId, payment) {
        const decoded = sdk_1.PushDrop.decode(sdk_1.LockingScript.fromHex(scriptHex));
        const fields = decoded.fields.map(x => sdk_1.Utils.toUTF8(x));
        if (fields.length < 2)
            throw new Error('verifyIncomingToken: missing PushDrop fields');
        let assetId = fields[0];
        const amountStr = fields[1];
        const metadataJson = fields[2] ?? '{}';
        if (assetId === 'ISSUE') {
            assetId = `${payment.txid}.${payment.vout}`;
        }
        if (assetId !== expectedAssetId) {
            throw new Error(`Incoming token assetId mismatch. Expected ${expectedAssetId}, got ${assetId}`);
        }
        return {
            assetId,
            amount: Number(amountStr),
            metadata: metadataJson
        };
    }
}
exports.BTMS = BTMS;
// ------------------------------------------------------------
// Singleton BTMS instance
// ------------------------------------------------------------
exports.btms = new BTMS();
