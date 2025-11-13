"use strict";
/*
  Legacy JS deps that don't ship .d.ts files.
  We just suppress them here so VS Code / tsc stop yelling.
  This keeps everything in THIS file, per instructions.
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.btms = exports.OverlayClient = exports.setBTMSAuthFetch = exports.sendBTMSToken = exports.BTMS = exports.decodeLinkageSimple = exports.createMarketplaceItem = exports.listMarketplaceItems = exports.createLocalToken = void 0;
// primitives that DO exist in @bsv/sdk 1.8.11
const sdk_1 = require("@bsv/sdk");
// ✅ local stub so we don’t have to install @bsv/message-box-client
// use the shared logger (so logging.config.ts can turn this on/off)
const logging_1 = require("../utils/logging");
const message_box_client_1 = require("@bsv/message-box-client");
const sdk_2 = require("@bsv/sdk");
/**
 * Global debug switch. Leave on while we’re chasing the repeated calls.
 */
const BTMS_DEBUG = true;
/**
 * A stable tag so we can see WHICH version of this file is being executed
 * after hot-reloads / re-bundles.
 */
const BTMS_SOURCE_TAG = 'frontend/src/btms/index.ts@debug-hmr-04';
/**
 * Simple wrapper so all BTMS debug lines have a consistent prefix.
 */
function btmsDebug(label, ...rest) {
    if (!BTMS_DEBUG)
        return;
    (0, logging_1.logWithTimestamp)(`[BTMS:${BTMS_SOURCE_TAG}] ${label}`, ...rest);
}
/**
 * per-call id so we can correlate
 */
function makeDebugCallId(prefix = 'call') {
    return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}
btmsDebug('module-load: file has been evaluated');
const ANYONE = '0000000000000000000000000000000000000000000000000000000000000001';
/* ------------------------------------------------------------------ */
/* small helpers                                                      */
/* ------------------------------------------------------------------ */
// pull the pubkey and the data fields out of a BTMS-style locking script
function parseBTMSScriptFull(scriptHex) {
    if (!scriptHex || typeof scriptHex !== 'string')
        return {};
    const lower = scriptHex.toLowerCase();
    let lockingPublicKey;
    // legacy BTMS script is: 21 <33-byte pubkey> ac <push assetId> <push amount> <push metadata> ... drops
    if (lower.startsWith('21') && lower.length > 70) {
        // after "21" we have 33 bytes (66 hex)
        lockingPublicKey = lower.slice(2, 68);
    }
    const decoded = decodeBTMSTokenFromScript(lower);
    return {
        lockingPublicKey,
        assetId: decoded?.assetId,
        amount: decoded?.amount,
        metadata: decoded?.metadata
    };
}
function shortHex(hex, len = 16) {
    if (!hex || typeof hex !== 'string')
        return String(hex);
    const h = hex.toLowerCase();
    return h.length <= len ? h : `${h.slice(0, len)}…(${h.length})`;
}
function isLikelyHex(s) {
    return typeof s === 'string' && /^[0-9a-fA-F]+$/.test(s);
}
/**
 * Global, optional, app-provided authenticated fetch.
 */
let activeAuthFetch = null;
function setBTMSAuthFetch(fn) {
    activeAuthFetch = fn;
}
exports.setBTMSAuthFetch = setBTMSAuthFetch;
async function fetchJSON(url, opts = {}) {
    const res = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...(opts.headers || {})
        },
        ...opts
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} for ${url}: ${text}`);
    }
    return (await res.json());
}
function makeId(prefix = 'id') {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
/* ------------------------------------------------------------------ */
/* normalize protocol id                                              */
/* ------------------------------------------------------------------ */
function normalizeProtocolID(protocolID) {
    return Array.isArray(protocolID) ? protocolID : [0, protocolID];
}
/* ------------------------------------------------------------------ */
/* wallet client we already have                                      */
/* ------------------------------------------------------------------ */
const WALLET_BASE = 'http://localhost:3321';
const walletClient = new sdk_1.WalletClient('json-api', WALLET_BASE);
void walletClient
    .getPublicKey({ identityKey: true })
    .then((pk) => btmsDebug('wallet.getPublicKey(identity):', pk))
    .catch((e) => btmsDebug('wallet.getPublicKey failed:', e));
/* ------------------------------------------------------------------ */
/* script extraction from a wallet-output object                      */
/* ------------------------------------------------------------------ */
function extractLockingScriptFromWalletOutput(o) {
    if (!o || typeof o !== 'object')
        return '';
    if (typeof o.outputScript === 'string' && o.outputScript)
        return o.outputScript;
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
/* if we only have an outpoint, try to fetch script from wallet HTTP  */
/* ------------------------------------------------------------------ */
function parseOutpoint(s) {
    if (!s || typeof s !== 'string')
        return { txid: '', vout: NaN };
    const sep = s.includes('.') ? '.' : s.includes(':') ? ':' : s.includes('-') ? '-' : '';
    if (!sep)
        return { txid: '', vout: NaN };
    const [t, v] = s.split(sep);
    return { txid: (t || '').toLowerCase(), vout: Number(v) };
}
async function fetchScriptForOutpoint(outpoint) {
    let txid = '';
    let voutStr = '';
    if (outpoint.includes('.')) {
        ;
        [txid, voutStr] = outpoint.split('.');
    }
    else if (outpoint.includes(':')) {
        ;
        [txid, voutStr] = outpoint.split(':');
    }
    else if (outpoint.includes('-')) {
        ;
        [txid, voutStr] = outpoint.split('-');
    }
    else {
        return '';
    }
    const vout = Number(voutStr);
    if (!txid || Number.isNaN(vout))
        return '';
    const candidateUrls = [
        `${WALLET_BASE}/api/v1/outputs/${txid}/${vout}`,
        `${WALLET_BASE}/api/outputs/${txid}/${vout}`,
        `${WALLET_BASE}/outputs/${txid}/${vout}`,
        `${WALLET_BASE}/api/v1/transactions/${txid}`
    ];
    for (const url of candidateUrls) {
        try {
            const res = await fetch(url);
            if (!res.ok)
                continue;
            const json = await res.json();
            if (BTMS_DEBUG) {
                btmsDebug('fetchScriptForOutpoint: got response from wallet:', {
                    url,
                    keys: Object.keys(json || {})
                });
            }
            const directScript = json.lockingScript ||
                json.outputScript ||
                json.script ||
                json?.output?.lockingScript ||
                json?.output?.script;
            if (typeof directScript === 'string' && directScript) {
                return directScript;
            }
            if (Array.isArray(json.outputs) && json.outputs[vout]) {
                const o = json.outputs[vout];
                const s = o.lockingScript ||
                    o.outputScript ||
                    o.script ||
                    o?.beefPayload?.outputs?.[0]?.lockingScript ||
                    '';
                if (s)
                    return s;
            }
        }
        catch (err) {
            if (BTMS_DEBUG) {
                btmsDebug('fetchScriptForOutpoint: request failed for ' + url, err);
            }
        }
    }
    const overlayUrl = `${window.BTMS_OVERLAY_BASE || 'http://localhost:8080'}/lookup`;
    const overlayBodies = [
        [{ service: 'ls_btms', query: { txid, vout } }]
    ];
    for (const body of overlayBodies) {
        try {
            const res = await fetch(overlayUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                if (BTMS_DEBUG) {
                    btmsDebug('fetchScriptForOutpoint: overlay lookup non-OK', {
                        status: res.status,
                        body
                    });
                }
                continue;
            }
            const json = await res.json();
            if (BTMS_DEBUG) {
                btmsDebug('fetchScriptForOutpoint: overlay lookup response', {
                    triedBody: body,
                    keys: json ? Object.keys(json) : [],
                    hasOutputs: Array.isArray(json?.outputs),
                    txid
                });
            }
            const fromArray = Array.isArray(json?.outputs) &&
                (json.outputs[vout] ||
                    json.outputs.find((o) => o?.vout === vout));
            const out = json?.output ||
                fromArray ||
                json?.beefPayload?.outputs?.[0] ||
                json;
            const overlayScript = out?.lockingScript ||
                out?.outputScript ||
                out?.script ||
                out?.beefPayload?.outputs?.[0]?.lockingScript;
            if (typeof overlayScript === 'string' && overlayScript) {
                if (BTMS_DEBUG) {
                    btmsDebug('fetchScriptForOutpoint: overlay gave us a script', {
                        preview: shortHex(overlayScript, 48),
                        len: overlayScript.length
                    });
                }
                return overlayScript;
            }
        }
        catch (err) {
            if (BTMS_DEBUG) {
                btmsDebug('fetchScriptForOutpoint: overlay lookup failed', {
                    message: err?.message
                });
            }
        }
    }
    return '';
}
/* ------------------------------------------------------------------ */
/* BTMS token script decoder                                          */
/* ------------------------------------------------------------------ */
function decodeBTMSTokenFromScript(scriptHex) {
    if (!scriptHex || typeof scriptHex !== 'string')
        return null;
    let body = scriptHex.toLowerCase();
    if (body.startsWith('21') && body.length > 70) {
        body = body.slice(70);
    }
    else if (body.startsWith('51')) {
        body = body.slice(2);
    }
    const fields = [];
    let i = 0;
    while (i < body.length) {
        const opcodeHex = body.slice(i, i + 2);
        if (!opcodeHex)
            break;
        const opcode = parseInt(opcodeHex, 16);
        if (opcode === 0x75 || opcode === 0x6d) {
            break;
        }
        if (opcode > 0 && opcode <= 0x4b) {
            const byteLen = opcode;
            const dataHex = body.slice(i + 2, i + 2 + byteLen * 2);
            const val = Buffer.from(dataHex, 'hex').toString('utf8');
            fields.push(val);
            i = i + 2 + byteLen * 2;
            continue;
        }
        if (opcode === 0x4c) {
            const lenHex = body.slice(i + 2, i + 4);
            const byteLen = parseInt(lenHex, 16);
            const dataHex = body.slice(i + 4, i + 4 + byteLen * 2);
            const val = Buffer.from(dataHex, 'hex').toString('utf8');
            fields.push(val);
            i = i + 4 + byteLen * 2;
            continue;
        }
        if (opcode === 0x4d) {
            const lenHexLE = body.slice(i + 2, i + 6);
            const lenBuf = Buffer.from(lenHexLE, 'hex');
            const byteLen = lenBuf.readUInt16LE(0);
            const dataHex = body.slice(i + 6, i + 6 + byteLen * 2);
            const val = Buffer.from(dataHex, 'hex').toString('utf8');
            fields.push(val);
            i = i + 6 + byteLen * 2;
            continue;
        }
        break;
    }
    const assetId = fields[0] || '';
    const amount = Number(fields[1] || '0') || 0;
    const metadata = fields[2] || '';
    if (!assetId)
        return null;
    return { assetId, amount, metadata };
}
function decodeBTMSTokenFromCustomInstructions(ci) {
    if (!ci)
        return null;
    let obj = ci;
    if (typeof ci === 'string') {
        try {
            obj = JSON.parse(ci);
        }
        catch {
            return null;
        }
    }
    if (obj.kind === 'btms-mint' && obj.assetId) {
        return {
            assetId: obj.assetId,
            amount: Number(obj.amount || 0),
            metadata: typeof obj.metadata === 'string' ? obj.metadata : JSON.stringify(obj.metadata || '')
        };
    }
    return null;
}
/* ------------------------------------------------------------------ */
/* mint helper                                                        */
/* ------------------------------------------------------------------ */
async function tryWalletMint(outputScript, basket, satoshis, description = 'BTMS mint', extra) {
    const wallet = walletClient;
    btmsDebug('MINT:tryWalletMint: start', {
        basket,
        satoshis,
        outputScriptPreview: shortHex(outputScript, 32),
        isHex: isLikelyHex(outputScript),
        length: typeof outputScript === 'string' ? outputScript.length : 'n/a',
        extra
    });
    if (!wallet) {
        btmsDebug('MINT:tryWalletMint: walletClient is undefined/null');
        return null;
    }
    const hasCreateAction = typeof wallet.createAction === 'function';
    const hasSubmitDirect = typeof wallet.submitDirectTransaction === 'function';
    const hasSubmitAction = typeof wallet.submitAction === 'function';
    btmsDebug('MINT:tryWalletMint: wallet feature detect', {
        hasCreateAction,
        hasSubmitDirectTransaction: hasSubmitDirect,
        hasSubmitAction
    });
    if (!hasCreateAction) {
        btmsDebug('MINT:tryWalletMint: wallet.createAction not available; returning script-only mint');
        return null;
    }
    if (typeof outputScript !== 'string') {
        btmsDebug('MINT:tryWalletMint: BAD outputScript type', {
            typeofOutputScript: typeof outputScript
        });
        throw new Error('outputScript must be a hex string');
    }
    const lockingScript = outputScript.trim();
    if (!isLikelyHex(lockingScript)) {
        btmsDebug('MINT:tryWalletMint: lockingScript fails hex check', shortHex(lockingScript));
    }
    const customInstructions = extra && (extra.assetId || extra.amount || extra.metadata)
        ? JSON.stringify({
            kind: 'btms-mint',
            assetId: extra.assetId,
            amount: extra.amount,
            metadata: extra.metadata
        })
        : undefined;
    const tags = ['btms', 'mint'];
    if (extra?.assetId) {
        tags.push(`asset:${extra.assetId}`);
    }
    const actionReq = {
        description,
        outputs: [
            {
                lockingScript,
                satoshis,
                basket,
                description,
                outputDescription: description && description.length >= 5 ? description : 'BTMS mint',
                customInstructions,
                tags
            }
        ],
        options: { randomizeOutputs: false }
    };
    btmsDebug('MINT:tryWalletMint: calling wallet.createAction with', {
        ...actionReq,
        outputs: actionReq.outputs.map(o => ({
            ...o,
            lockingScript: shortHex(o.lockingScript, 32)
        }))
    });
    const startedAt = Date.now();
    const action = await wallet.createAction(actionReq).catch((err) => {
        btmsDebug('MINT:tryWalletMint: wallet.createAction FAILED', {
            message: err?.message,
            name: err?.name,
            stack: err?.stack
        });
        return null;
    });
    btmsDebug('MINT:tryWalletMint: wallet.createAction durationMs', Date.now() - startedAt);
    if (!action) {
        btmsDebug('MINT:tryWalletMint: createAction returned null — likely validation failure above');
        return null;
    }
    try {
        const atomicBeef = action.tx || action.atomicBeef || action.beef;
        if (atomicBeef) {
            btmsDebug('MINT:tryWalletMint: action has atomic BEEF, broadcasting via HTTPSOverlay + SHIP…');
            const tx = sdk_1.Transaction.fromAtomicBEEF(atomicBeef);
            const facilitator = new sdk_1.HTTPSOverlayBroadcastFacilitator(fetch, true);
            facilitator.allowHTTP = true;
            const broadcaster = new sdk_1.SHIPBroadcaster(['tm_btms'], {
                networkPreset: 'local',
                facilitator,
                requireAcknowledgmentFromAnyHostForTopics: 'any'
            });
            const result = await broadcaster.broadcast(tx);
            btmsDebug('MINT:tryWalletMint: SHIP broadcast result', result);
        }
        else {
            btmsDebug('MINT:tryWalletMint: createAction result had no atomic BEEF (tx) — skipping broadcast');
        }
    }
    catch (e) {
        btmsDebug('MINT:tryWalletMint: BTMS/SHIP broadcast failed (continuing)', {
            message: e?.message,
            stack: e?.stack
        });
    }
    try {
        if (hasSubmitDirect) {
            btmsDebug('MINT:tryWalletMint: calling wallet.submitDirectTransaction(...)');
            await wallet.submitDirectTransaction(action);
            btmsDebug('MINT:tryWalletMint: wallet.submitDirectTransaction done');
        }
        else if (hasSubmitAction) {
            btmsDebug('MINT:tryWalletMint: calling wallet.submitAction(...)');
            await wallet.submitAction(action);
            btmsDebug('MINT:tryWalletMint: wallet.submitAction done');
        }
        else {
            btmsDebug('MINT:tryWalletMint: no submit method present; keeping BEEF only.');
        }
    }
    catch (err) {
        btmsDebug('MINT:tryWalletMint: wallet submit failed (continuing)', {
            message: err?.message,
            name: err?.name,
            stack: err?.stack
        });
    }
    btmsDebug('MINT:tryWalletMint: SUCCESS path done, returning action');
    return action;
}
/* ------------------------------------------------------------------ */
/* wallet helper wrappers                                             */
/* ------------------------------------------------------------------ */
async function walletGetPublicKey(args) {
    const res = await walletClient.getPublicKey(args);
    if (typeof res === 'string')
        return res;
    if (res && typeof res.publicKey === 'string')
        return res.publicKey;
    return String(res ?? '');
}
async function walletCreateSignature(args) {
    const payload = {
        data: Array.from(args.data),
        protocolID: normalizeProtocolID(args.protocolID),
        keyID: args.keyID,
        counterparty: args.counterparty
    };
    btmsDebug('wallet.createSignature payload:', {
        protocolID: payload.protocolID,
        keyID: payload.keyID,
        counterparty: payload.counterparty,
        dataLen: payload.data.length
    });
    const res = await walletClient.createSignature(payload);
    if (res instanceof Uint8Array)
        return res;
    if (res && Array.isArray(res.signature))
        return Uint8Array.from(res.signature);
    if (Array.isArray(res))
        return Uint8Array.from(res);
    return new Uint8Array();
}
/* ------------------------------------------------------------------ */
/* overlay client                                                     */
/* ------------------------------------------------------------------ */
class OverlayClient {
    constructor(baseUrl, apiKey) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.apiKey = apiKey;
    }
    buildHeaders(extra) {
        return {
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
            ...(extra || {})
        };
    }
    async get(path) {
        const url = `${this.baseUrl}${path}`;
        return await fetchJSON(url, {
            method: 'GET',
            headers: this.buildHeaders()
        });
    }
    async post(path, body) {
        const url = `${this.baseUrl}${path}`;
        return await fetchJSON(url, {
            method: 'POST',
            headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(body)
        });
    }
}
exports.OverlayClient = OverlayClient;
function createLocalToken(assetId, amount, metadata) {
    return {
        id: makeId('localToken'),
        assetId,
        amount,
        metadata
    };
}
exports.createLocalToken = createLocalToken;
async function listMarketplaceItems(client, query = { findAll: true }) {
    const res = await client.post('/lookup', {
        provider: 'marketplace',
        query
    });
    return res.map((x) => x);
}
exports.listMarketplaceItems = listMarketplaceItems;
async function createMarketplaceItem(client, item) {
    const res = await client.post('/submit', {
        ...item,
        provider: 'marketplace'
    });
    return res;
}
exports.createMarketplaceItem = createMarketplaceItem;
function decodeLinkageSimple(prover, linkageScalarHex) {
    return {
        prover,
        derivedKey: linkageScalarHex
    };
}
exports.decodeLinkageSimple = decodeLinkageSimple;
const minimalEncoding = (buf) => {
    if (!(buf instanceof Buffer)) {
        buf = Buffer.from(buf);
    }
    if (buf.byteLength === 0) {
        return '00';
    }
    if (buf.byteLength === 1 && buf[0] === 0) {
        return '00';
    }
    if (buf.byteLength === 1 && buf[0] > 0 && buf[0] <= 16) {
        return (0x50 + buf[0]).toString(16);
    }
    if (buf.byteLength === 1 && buf[0] === 0x81) {
        return '4f';
    }
    if (buf.byteLength <= 75) {
        return Buffer.concat([
            Buffer.from([buf.byteLength]),
            buf
        ]).toString('hex');
    }
    if (buf.byteLength <= 255) {
        return Buffer.concat([
            Buffer.from([0x4c]),
            Buffer.from([buf.byteLength]),
            buf
        ]).toString('hex');
    }
    if (buf.byteLength <= 65535) {
        const len = Buffer.alloc(2);
        len.writeUInt16LE(buf.byteLength);
        return Buffer.concat([
            Buffer.from([0x4d]),
            len,
            buf
        ]).toString('hex');
    }
    const len = Buffer.alloc(4);
    len.writeUInt32LE(buf.byteLength);
    return Buffer.concat([
        Buffer.from([0x4e]),
        len,
        buf
    ]).toString('hex');
};
const OP_DROP = '75';
const OP_2DROP = '6d';
/* ------------------------------------------------------------------ */
/* token lock / unlock                                                */
/* ------------------------------------------------------------------ */
class BTMSToken {
    constructor() {
        this.unlock = (protocolID, keyID, counterparty, sourceTXID, sourceSatoshis, lockingScript, signOutputs = 'all', anyoneCanPay = false) => {
            return {
                sign: async (tx, inputIndex) => {
                    const input = tx.inputs[inputIndex];
                    const otherInputs = tx.inputs.filter((_, index) => index !== inputIndex);
                    sourceTXID = input.sourceTXID
                        ? input.sourceTXID
                        : input.sourceTransaction?.id('hex');
                    if (!sourceTXID) {
                        throw new Error('The input sourceTXID or sourceTransaction is required for transaction signing.');
                    }
                    sourceSatoshis || (sourceSatoshis = input.sourceTransaction?.outputs[input.sourceOutputIndex].satoshis);
                    if (!sourceSatoshis) {
                        throw new Error('The sourceSatoshis or input sourceTransaction is required for transaction signing.');
                    }
                    lockingScript || (lockingScript = input.sourceTransaction?.outputs[input.sourceOutputIndex].lockingScript);
                    if (!lockingScript) {
                        throw new Error('The lockingScript or input sourceTransaction is required for transaction signing.');
                    }
                    let signatureScope = sdk_1.TransactionSignature.SIGHASH_FORKID;
                    if (signOutputs === 'all') {
                        signatureScope |= sdk_1.TransactionSignature.SIGHASH_ALL;
                    }
                    if (signOutputs === 'none') {
                        signatureScope |= sdk_1.TransactionSignature.SIGHASH_NONE;
                    }
                    if (signOutputs === 'single') {
                        signatureScope |= sdk_1.TransactionSignature.SIGHASH_SINGLE;
                    }
                    if (anyoneCanPay) {
                        signatureScope |= sdk_1.TransactionSignature.SIGHASH_ANYONECANPAY;
                    }
                    const preimage = sdk_1.TransactionSignature.format({
                        sourceTXID,
                        sourceOutputIndex: input.sourceOutputIndex,
                        sourceSatoshis,
                        transactionVersion: tx.version,
                        otherInputs,
                        inputIndex,
                        outputs: tx.outputs,
                        inputSequence: input.sequence ?? 0xffffffff,
                        subscript: lockingScript,
                        lockTime: tx.lockTime,
                        scope: signatureScope
                    });
                    const preimageHash = sdk_1.Hash.sha256(preimage);
                    const SDKSignature = await walletCreateSignature({
                        data: Uint8Array.from(preimageHash),
                        protocolID,
                        keyID,
                        counterparty
                    });
                    const rawSignature = sdk_1.Signature.fromDER([...SDKSignature]);
                    const sig = new sdk_1.TransactionSignature(rawSignature.r, rawSignature.s, signatureScope);
                    const sigForScript = sig.toChecksigFormat();
                    return new sdk_1.UnlockingScript([
                        { op: sigForScript.length, data: sigForScript }
                    ]);
                },
                estimateLength: async () => 72
            };
        };
    }
    async lock(protocolID, keyID, counterparty, assetId, amount, metadata, forSelf = false) {
        let publicKey = null;
        try {
            publicKey = await walletGetPublicKey({
                protocolID: normalizeProtocolID(protocolID),
                keyID,
                counterparty,
                forSelf
            });
        }
        catch {
            // ignore
        }
        let lockPart;
        if (publicKey) {
            lockPart = new sdk_1.LockingScript([
                { op: publicKey.length / 2, data: sdk_1.Utils.toArray(publicKey, 'hex') },
                { op: sdk_1.OP.OP_CHECKSIG }
            ]).toHex();
        }
        else {
            lockPart = '51';
        }
        const fields = [
            assetId ?? '',
            String(typeof amount === 'number' ? amount : Number(amount ?? 0)),
            metadata ?? ''
        ];
        try {
            const dataToSign = Buffer.concat(fields.map(x => typeof x === 'string' ? Buffer.from(x) : Buffer.from(x)));
            const signature = await walletCreateSignature({
                data: Uint8Array.from(dataToSign),
                protocolID,
                keyID,
                counterparty
            });
            if (signature && signature.length) {
                fields.push(signature);
            }
        }
        catch {
            // ignore
        }
        const pushPart = fields.reduce((acc, el) => acc + minimalEncoding(el), '');
        let dropPart = '';
        let undropped = fields.length;
        while (undropped > 1) {
            dropPart += OP_2DROP;
            undropped -= 2;
        }
        if (undropped) {
            dropPart += OP_DROP;
        }
        return sdk_1.LockingScript.fromHex(`${lockPart}${pushPart}${dropPart}`);
    }
}
/* ------------------------------------------------------------------ */
/* funding token (unchanged)                                          */
/* ------------------------------------------------------------------ */
class BTMSFundingToken {
    constructor() {
        this.unlock = (protocolID, keyID, counterparty) => {
            return {
                sign: async (tx, inputIndex) => {
                    const input = tx.inputs[inputIndex];
                    const otherInputs = tx.inputs.filter((_, index) => index !== inputIndex);
                    const sourceTXID = input.sourceTXID
                        ? input.sourceTXID
                        : input.sourceTransaction?.id('hex');
                    if (!sourceTXID) {
                        throw new Error('The input sourceTXID or sourceTransaction is required for transaction signing.');
                    }
                    const sourceSatoshis = input.sourceTransaction?.outputs[input.sourceOutputIndex].satoshis;
                    if (!sourceSatoshis) {
                        throw new Error('The sourceSatoshis or input sourceTransaction is required for transaction signing.');
                    }
                    const lockingScript = input.sourceTransaction?.outputs[input.sourceOutputIndex].lockingScript;
                    if (!lockingScript) {
                        throw new Error('The lockingScript or input sourceTransaction is required for transaction signing.');
                    }
                    const signatureScope = sdk_1.TransactionSignature.SIGHASH_FORKID |
                        sdk_1.TransactionSignature.SIGHASH_ALL;
                    const preimage = sdk_1.TransactionSignature.format({
                        sourceTXID,
                        sourceOutputIndex: input.sourceOutputIndex,
                        sourceSatoshis,
                        transactionVersion: tx.version,
                        otherInputs,
                        inputIndex,
                        outputs: tx.outputs,
                        inputSequence: input.sequence ?? 0xffffffff,
                        subscript: lockingScript,
                        lockTime: tx.lockTime,
                        scope: signatureScope
                    });
                    const preimageHash = sdk_1.Hash.sha256(preimage);
                    const SDKSignature = await walletCreateSignature({
                        data: Uint8Array.from(preimageHash),
                        protocolID,
                        keyID,
                        counterparty
                    });
                    const rawSignature = sdk_1.Signature.fromDER([...SDKSignature]);
                    const sig = new sdk_1.TransactionSignature(rawSignature.r, rawSignature.s, signatureScope);
                    const sigForScript = sig.toChecksigFormat();
                    const publicKeyString = await walletGetPublicKey({
                        protocolID: normalizeProtocolID(protocolID),
                        keyID,
                        counterparty,
                        forSelf: true
                    });
                    return new sdk_1.UnlockingScript([
                        { op: sigForScript.length, data: sigForScript },
                        {
                            op: publicKeyString.length / 2,
                            data: sdk_1.Utils.toArray(publicKeyString, 'hex')
                        }
                    ]);
                },
                estimateLength: async () => 106
            };
        };
    }
    async lock(protocolID, keyID, counterparty) {
        const fundingPublicKeyString = await walletGetPublicKey({
            protocolID: normalizeProtocolID(protocolID),
            keyID,
            counterparty
        });
        const fundingAddress = sdk_1.PublicKey.fromString(fundingPublicKeyString).toAddress();
        return new sdk_1.P2PKH().lock(fundingAddress);
    }
}
/**
 * HMR-safe global cache
 * we stash it on globalThis so every time webpack reloads this file
 * we don’t lose the last snapshot and re-log the same “count: 0”.
 */
const GLOBAL_CACHE_KEY = '__btmsGlobalCache__';
const globalCache = (() => {
    if (typeof globalThis !== 'undefined') {
        if (!globalThis.__btmsGlobalCache__) {
            globalThis.__btmsGlobalCache__ = {
                lastAssetSnapshot: [],
                lastAssetFetchMs: 0,
                hasFetchedOnce: false
            };
        }
        return globalThis.__btmsGlobalCache__;
    }
    return {
        lastAssetSnapshot: [],
        lastAssetFetchMs: 0,
        hasFetchedOnce: false
    };
})();
// fallback values if globalThis isn’t available
let __btmsLastAssetSnapshot = globalCache.lastAssetSnapshot;
let __btmsLastAssetFetchMs = globalCache.lastAssetFetchMs;
const ASSET_REFRESH_MS = 30000; // 30 seconds
function verifyTruthy(v, description) {
    if (v == null)
        throw new Error(description ?? 'A truthy value is required.');
    return v;
}
/* ------------------------------------------------------------------ */
/* message-box-client transport (now uses stub)                       */
/* ------------------------------------------------------------------ */
const DEFAULT_MESSAGEBOX_HOST = 'https://messagebox.babbage.systems';
class MessageBoxTokenator {
    constructor(wallet, defaultBox, host = DEFAULT_MESSAGEBOX_HOST) {
        this.client = null;
        this.initPromise = null;
        this.wallet = wallet;
        this.defaultBox = defaultBox;
        this.host = host;
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
            this.initPromise = (async () => {
                const client = new message_box_client_1.MessageBoxClient({
                    host: this.host,
                    networkPreset: 'mainnet',
                    walletClient: this.wallet,
                    enableLogging: true
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
    async sendMessage(args) {
        const client = await this.ensureClient();
        const { recipient, messageBox, body } = args;
        const box = messageBox || this.defaultBox;
        // Always send a string to Message Box
        const payload = typeof body === 'string' ? body : JSON.stringify(body);
        // Helper to safely parse JSON strings for logging only
        const safeParse = (s) => {
            try {
                return JSON.parse(s);
            }
            catch {
                return null;
            }
        };
        // Compute beef length without touching the string 'payload'
        const bodyObj = typeof body === 'string' ? safeParse(body) : body;
        const beefArr = (bodyObj && Array.isArray(bodyObj?.beef) && bodyObj.beef) ||
            (bodyObj && Array.isArray(bodyObj?.token?.beef) && bodyObj.token.beef) ||
            null;
        const beefLen = Array.isArray(beefArr) ? beefArr.length : null;
        if (BTMS_DEBUG) {
            btmsDebug('MessageBoxTokenator.sendMessage ->', {
                recipient,
                box,
                bodyPreview: typeof payload === 'string' ? payload.slice(0, 160) : String(typeof payload),
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
            btmsDebug('[Tokenator] sendMessage OK', {
                ms: Date.now() - t0,
                hasResp: resp != null,
                keys: resp ? Object.keys(resp) : [],
                status: resp?.status ?? 'unknown',
                id: resp?.id ?? resp?.messageId ?? resp?._id ?? null,
                beefLen
            });
        }
        catch (e) {
            btmsDebug('[Tokenator] sendMessage ERROR', {
                ms: Date.now() - t0,
                message: e?.message,
                stackTop: String(e?.stack || '').split('\n').slice(0, 3).join(' | ')
            });
            throw e;
        }
    }
    async listMessages(args) {
        const client = await this.ensureClient();
        const box = args.messageBox || this.defaultBox;
        const msgs = await client.listMessages({ messageBox: box });
        return msgs;
    }
    async acknowledgeMessage(args) {
        return this.acknowledgeMessages(args);
    }
    async acknowledgeMessages(args) {
        const client = await this.ensureClient();
        if (!args.messageIds || !args.messageIds.length)
            return;
        await client.acknowledgeMessage({ messageIds: args.messageIds });
    }
}
/* ------------------------------------------------------------------ */
/* main BTMS class                                                    */
/* ------------------------------------------------------------------ */
class BTMS {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(tokensMessageBox = 'tokens-box', protocolID = [0, 'tokens'], basket = 'tokens', tokensTopic = 'tokens', satoshis = 5, privateKey, marketplaceMessageBox = 'marketplace', marketplaceTopic = 'marketplace') {
        this.tokensMessageBox = tokensMessageBox;
        const normalized = Array.isArray(protocolID)
            ? protocolID
            : [0, protocolID];
        this.protocolID = normalized;
        this.basket = basket;
        this.tokenTopic = tokensTopic;
        this.satoshis = satoshis;
        this.tokenator = new MessageBoxTokenator(walletClient, tokensMessageBox);
        this.privateKey = privateKey;
        this.marketplaceMessageBox = marketplaceMessageBox;
        this.marketplaceTopic = marketplaceTopic;
        this.requester = activeAuthFetch
            ? (url, init) => activeAuthFetch(url, init)
            : (url, init) => fetch(url, init);
        this.instanceId = makeId('btmsInstance');
        // Initialize LookupResolver: default preset now, refine once wallet reports network
        try {
            const defaultPreset = (typeof location !== 'undefined' && location.hostname === 'localhost')
                ? 'local'
                : 'mainnet';
            // start with a sensible default immediately
            this.lookupResolver = new sdk_2.LookupResolver({ networkPreset: defaultPreset });
            // refine asynchronously if wallet exposes getNetwork()
            const maybeGetNetwork = walletClient?.getNetwork;
            if (typeof maybeGetNetwork === 'function') {
                Promise.resolve()
                    .then(() => maybeGetNetwork.call(walletClient))
                    .then((nw) => {
                    const net = nw?.network;
                    if (net === 'mainnet' || net === 'testnet' || net === 'local') {
                        this.lookupResolver = new sdk_2.LookupResolver({ networkPreset: net });
                        btmsDebug('LookupResolver updated from wallet.getNetwork()', { net });
                    }
                })
                    .catch(() => {
                    // keep default
                });
            }
        }
        catch {
            // keep default if anything goes wrong
        }
        btmsDebug('constructor called', {
            protocolID: this.protocolID,
            instanceId: this.instanceId,
            source: BTMS_SOURCE_TAG,
            stack: new Error('BTMS constructor stack').stack
        });
    }
    async getPublicKey(args) {
        const normalized = {
            ...args,
            protocolID: args.protocolID ? normalizeProtocolID(args.protocolID) : undefined
        };
        return walletGetPublicKey(normalized);
    }
    async listAssets() {
        const callId = makeDebugCallId('listAssets');
        btmsDebug(`${callId}: start`, { instanceId: this.instanceId });
        try {
            const now = Date.now();
            const age = now - globalCache.lastAssetFetchMs;
            /**
             * NEW BEHAVIOR:
             * if we have ever fetched once and the snapshot is still empty,
             * just serve the empty snapshot forever (or until someone explicitly
             * calls a “refresh”) so we don’t pester the wallet every 30s.
             */
            if (globalCache.hasFetchedOnce && globalCache.lastAssetSnapshot.length === 0) {
                btmsDebug(`${callId}: serving EMPTY snapshot from GLOBAL cache (suppressing re-fetch)`, {
                    ageMs: age,
                    count: 0,
                    instanceId: this.instanceId
                });
                return [];
            }
            // normal 30s cache
            if (age < ASSET_REFRESH_MS) {
                btmsDebug(`${callId}: serving from GLOBAL cache (even if empty)`, {
                    ageMs: age,
                    count: globalCache.lastAssetSnapshot.length,
                    instanceId: this.instanceId
                });
                return globalCache.lastAssetSnapshot.map(a => ({ ...a }));
            }
            else {
                btmsDebug(`${callId}: cache miss or stale`, {
                    ageMs: age,
                    hadSnapshot: globalCache.lastAssetSnapshot.length > 0,
                    refreshMs: ASSET_REFRESH_MS,
                    hasFetchedOnce: globalCache.hasFetchedOnce
                });
            }
            const wallet = walletClient;
            const assets = new Map();
            let bsvTotal = 0;
            let outs = [];
            // prefer the non-naggy API first
            if (typeof wallet.listOutputs === 'function') {
                const args = {
                    basket: this.basket,
                    limit: 200,
                    offset: 0,
                    includeEnvelope: true,
                    includeCustomInstructions: true,
                    seekPermission: false
                };
                btmsDebug(`${callId}: calling wallet.listOutputs(...)`, {
                    args,
                    instanceId: this.instanceId
                });
                try {
                    const res = await wallet.listOutputs(args);
                    outs = res?.outputs ?? [];
                    btmsDebug(`${callId}: wallet.listOutputs OK`, {
                        returnedKeys: res ? Object.keys(res) : [],
                        count: outs.length
                    });
                }
                catch (err) {
                    btmsDebug(`${callId}: wallet.listOutputs FAILED`, {
                        message: err?.message,
                        name: err?.name,
                        stack: err?.stack,
                        looksLikePermission: typeof err?.message === 'string' && /perm/i.test(err.message)
                    });
                    // since we *attempted*, don’t let the UI keep hammering
                    globalCache.hasFetchedOnce = true;
                }
            }
            else {
                btmsDebug(`${callId}: wallet has NO listOutputs`, {
                    walletKeys: Object.keys(wallet || {})
                });
                // also mark tried
                globalCache.hasFetchedOnce = true;
            }
            btmsDebug(`${callId}: wallet returned outputs:`, {
                count: outs.length,
                basket: this.basket,
                instanceId: this.instanceId
            });
            let idx = 0;
            for (const o of outs) {
                idx += 1;
                // support both new-world beefPayload
                const beefPayload = o.beefPayload || null;
                let scriptHex = extractLockingScriptFromWalletOutput(o);
                if (!scriptHex && o.outpoint) {
                    btmsDebug(`${callId}: output #${idx} has outpoint ${o.outpoint} but no script — fetching from wallet/overlay…`, { instanceId: this.instanceId });
                    scriptHex = await fetchScriptForOutpoint(o.outpoint);
                    btmsDebug(`${callId}: output #${idx} fetched script len=`, scriptHex ? scriptHex.length : 0, { instanceId: this.instanceId });
                }
                btmsDebug(`${callId}: output #${idx}`, {
                    satoshis: o.satoshis,
                    outputScriptPreview: shortHex(scriptHex, 48),
                    outputScriptLen: scriptHex ? scriptHex.length : 0,
                    hasBeefPayload: !!beefPayload,
                    instanceId: this.instanceId
                });
                // -------------------------------------------------------------------
                // 1) No visible script? Try to recover via customInstructions / beef.
                // -------------------------------------------------------------------
                if (!scriptHex) {
                    const ci = o.customInstructions ||
                        beefPayload?.outputs?.[0]?.customInstructions;
                    const decodedFromCI = decodeBTMSTokenFromCustomInstructions(ci);
                    if (decodedFromCI) {
                        const existing = assets.get(decodedFromCI.assetId);
                        let friendlyName;
                        if (decodedFromCI.metadata) {
                            try {
                                const parsed = JSON.parse(decodedFromCI.metadata);
                                friendlyName =
                                    parsed.name ||
                                        parsed.tokenName ||
                                        parsed.title ||
                                        decodedFromCI.assetId;
                            }
                            catch {
                                friendlyName = decodedFromCI.metadata;
                            }
                        }
                        if (existing) {
                            existing.balance += decodedFromCI.amount;
                        }
                        else {
                            assets.set(decodedFromCI.assetId, {
                                assetId: decodedFromCI.assetId,
                                balance: decodedFromCI.amount,
                                name: friendlyName || decodedFromCI.assetId,
                                metadata: decodedFromCI.metadata
                            });
                        }
                        continue;
                    }
                    const sat = o.satoshis || o.amount || 0;
                    bsvTotal += sat;
                    btmsDebug(`${callId}: output #${idx} had NO script ANYWHERE, counted as BSV`, {
                        addedSatoshis: sat,
                        runningBSV: bsvTotal,
                        raw: o,
                        instanceId: this.instanceId
                    });
                    continue;
                }
                // -------------------------------------------------------------------
                // 2) Script present: try pure BTMS decode; if that fails, count as BSV.
                // -------------------------------------------------------------------
                const decoded = decodeBTMSTokenFromScript(scriptHex);
                if (decoded) {
                    const existing = assets.get(decoded.assetId);
                    let friendlyName;
                    if (decoded.metadata) {
                        try {
                            const parsed = JSON.parse(decoded.metadata);
                            friendlyName =
                                parsed.name ||
                                    parsed.tokenName ||
                                    parsed.title ||
                                    decoded.assetId;
                        }
                        catch {
                            friendlyName = decoded.metadata;
                        }
                    }
                    if (existing) {
                        existing.balance += decoded.amount;
                    }
                    else {
                        assets.set(decoded.assetId, {
                            assetId: decoded.assetId,
                            balance: decoded.amount,
                            name: friendlyName || decoded.assetId,
                            metadata: decoded.metadata
                        });
                    }
                }
                else {
                    const sat = o.satoshis || o.amount || 0;
                    bsvTotal += sat;
                    btmsDebug(`${callId}: output #${idx} script did NOT look like BTMS, counted as BSV`, {
                        addedSatoshis: sat,
                        runningBSV: bsvTotal,
                        instanceId: this.instanceId
                    });
                }
            }
            const result = Array.from(assets.values());
            if (bsvTotal > 0) {
                result.unshift({ assetId: 'BSV', balance: bsvTotal });
            }
            btmsDebug(`${callId}: FINAL ASSET LIST ->`, result, {
                instanceId: this.instanceId
            });
            // update global cache (even if empty — and mark that we have fetched once)
            globalCache.lastAssetSnapshot = result.map(a => ({ ...a }));
            globalCache.lastAssetFetchMs = now;
            globalCache.hasFetchedOnce = true;
            return result;
        }
        catch (err) {
            btmsDebug('listAssets failed, returning cached or empty.', err, {
                instanceId: this.instanceId
            });
            // if we failed, remember that we *did* try — so we don’t spam again
            globalCache.hasFetchedOnce = true;
            if (globalCache.lastAssetSnapshot.length) {
                return globalCache.lastAssetSnapshot.map(a => ({ ...a }));
            }
            return [];
        }
    }
    async listIncomingPayments(assetId) {
        // the client is JS-y; tell TS what shape we expect
        const msgs = (await this.tokenator.listMessages({
            messageBox: this.tokensMessageBox
        }));
        const results = [];
        for (const msg of msgs) {
            try {
                // msg.body can be string or object
                const rawBody = msg.body;
                // sometimes it's a stringified string (double-encoded), sometimes one level
                let payload;
                if (typeof rawBody === 'string') {
                    const once = JSON.parse(rawBody);
                    payload = typeof once === 'string' ? JSON.parse(once) : once;
                }
                else {
                    payload = rawBody;
                }
                const amt = payload.amount ??
                    payload.token?.amount ??
                    0;
                const msgAssetId = payload.assetId ??
                    payload.token?.assetId;
                if (assetId && msgAssetId && msgAssetId !== assetId) {
                    continue;
                }
                const payment = {
                    txid: payload.txid ?? '',
                    vout: payload.vout ?? 0,
                    outputScript: payload.outputScript ?? '',
                    amount: amt,
                    token: payload.token ?? {
                        txid: payload.txid ?? '',
                        vout: payload.vout ?? 0,
                        amount: amt,
                        beefPayload: (payload.beefPayload ?? {}),
                        keyID: payload.keyID ?? 'default',
                        outputScript: payload.outputScript ?? ''
                    },
                    sender: msg.sender,
                    messageId: msg.messageId,
                    keyID: payload.keyID ?? 'default',
                    beefPayload: (payload.beefPayload ?? {})
                };
                results.push(payment);
            }
            catch (err) {
                btmsDebug('failed to parse incoming payment message', err, msg);
            }
        }
        return results;
    }
    async acceptIncomingPayment(assetId, payment) {
        const callId = makeDebugCallId('acceptIncomingPayment');
        btmsDebug(`${callId}: start`, { assetId, payment });
        // ---- 1) Get the locking script (prefer from message) ----
        let scriptHex = payment.outputScript;
        if (!scriptHex) {
            // fall back to helper that can ask wallet / overlay
            scriptHex = await fetchScriptForOutpoint(`${payment.txid}.${payment.vout ?? 0}`);
        }
        if (!scriptHex) {
            btmsDebug(`${callId}: no script available for payment, will ack & bail`, { payment });
            if (payment?.messageId) {
                await this.tokenator.acknowledgeMessage({ messageIds: [payment.messageId] });
            }
            throw new Error('Incoming payment missing outputScript and could not be fetched');
        }
        // ---- 2) Decode script to get assetId, amount, metadata, lockingPublicKey ----
        const parsed = parseBTMSScriptFull(scriptHex);
        const parsedAssetId = parsed.assetId;
        const parsedAmount = parsed.amount;
        // Handle ISSUE -> txid.vout aliasing (same as old world)
        const actualAssetId = parsedAssetId && parsedAssetId !== 'ISSUE'
            ? parsedAssetId
            : `${payment.txid}.${payment.vout ?? 0}`;
        btmsDebug(`${callId}: parsed script`, {
            parsed,
            actualAssetId,
            requestedAssetId: assetId
        });
        // ---- 3) Asset ID must match ----
        if (assetId && actualAssetId && assetId !== actualAssetId) {
            btmsDebug(`${callId}: token assetId mismatch (wanted ${assetId}, got ${actualAssetId}) — acking and failing`);
            if (payment?.messageId) {
                await this.tokenator.acknowledgeMessage({ messageIds: [payment.messageId] });
            }
            throw new Error(`This token is for assetId ${actualAssetId}, but you tried to accept ${assetId}`);
        }
        // ---- 4) Verify token was locked to *our* derived key (old-world semantics) ----
        // We ONLY continue silently if we genuinely cannot verify,
        // but we HARD FAIL on a positive mismatch.
        let myKeyHex;
        if (parsed.lockingPublicKey) {
            try {
                const myKey = await this.getPublicKey({
                    protocolID: this.protocolID,
                    keyID: payment.keyID || 'default',
                    counterparty: payment.sender,
                    forSelf: true
                });
                myKeyHex = myKey?.toLowerCase();
                btmsDebug(`${callId}: got my locking key`, { myKeyHex });
            }
            catch (e) {
                btmsDebug(`${callId}: could not fetch my locking key (continuing anyway)`, {
                    message: e?.message
                });
            }
            if (myKeyHex) {
                const normalizedLock = parsed.lockingPublicKey.toLowerCase();
                if (myKeyHex !== normalizedLock) {
                    btmsDebug(`${callId}: locking key mismatch — token is not for me, acking msg`, {
                        mine: myKeyHex,
                        theirs: normalizedLock
                    });
                    if (payment?.messageId) {
                        await this.tokenator.acknowledgeMessage({ messageIds: [payment.messageId] });
                    }
                    throw new Error('Received token not belonging to me');
                }
            }
        }
        // ---- 5) Ensure token is on overlay (old-world strict behaviour) ----
        const vout = payment.vout ?? 0;
        btmsDebug(`${callId}: checking overlay presence`, {
            txid: payment.txid,
            vout
        });
        const alreadyThere = await this.findFromTokenOverlay({
            txid: payment.txid,
            vout
        });
        if (!alreadyThere.length) {
            btmsDebug(`${callId}: token not on overlay — attempting to submit`);
            const beefPayload = payment.beefPayload;
            if (!beefPayload ||
                !Array.isArray(beefPayload.atomicBeef) ||
                !beefPayload.atomicBeef.length) {
                btmsDebug(`${callId}: missing or invalid beefPayload.atomicBeef on incoming payment — acking & failing`, { payment });
                if (payment?.messageId) {
                    await this.tokenator.acknowledgeMessage({ messageIds: [payment.messageId] });
                }
                throw new Error('Incoming payment is missing required beefPayload.atomicBeef');
            }
            try {
                await this.submitToTokenOverlay({
                    atomicBeef: beefPayload.atomicBeef
                });
            }
            catch (err) {
                btmsDebug(`${callId}: submitToTokenOverlay failed`, {
                    message: err?.message
                });
                // fall through to strict re-check below
            }
            // Re-check as in old world: must be on overlay now
            const verifiedAfterSubmit = await this.findFromTokenOverlay({
                txid: payment.txid,
                vout
            });
            if (!verifiedAfterSubmit.length) {
                btmsDebug(`${callId}: token is for me but still not on overlay after submit — acking & failing`);
                if (payment?.messageId) {
                    await this.tokenator.acknowledgeMessage({ messageIds: [payment.messageId] });
                }
                throw new Error('Token is for me but not on the overlay');
            }
        }
        else {
            btmsDebug(`${callId}: token already present on overlay`);
        }
        // ---- 6) Build UX metadata (note/labels) from parsed metadata ----
        let tokenName = 'Token';
        let labels = [];
        let amountStr = parsedAmount != null ? String(parsedAmount) : '';
        try {
            if (parsed.metadata) {
                // parsed.metadata might already be an object or a JSON string;
                // adjust according to your parseBTMSScriptFull implementation
                const meta = typeof parsed.metadata === 'string'
                    ? JSON.parse(parsed.metadata)
                    : parsed.metadata;
                if (meta && typeof meta.name === 'string') {
                    tokenName = meta.name;
                }
                else if (meta && typeof meta.description === 'string') {
                    tokenName = meta.description;
                }
            }
        }
        catch (e) {
            // ignore metadata parse errors
        }
        if (actualAssetId) {
            labels = [actualAssetId.replace('.', ' ')];
        }
        const note = `Receive ${amountStr} ${tokenName} from ${payment.sender}`;
        btmsDebug(`${callId}: built wallet note/labels`, { note, labels });
        // ---- 7) Tell the wallet “this is mine now” (new-world, BEEF) ----
        try {
            const wallet = walletClient;
            if (typeof wallet.submitDirectTransaction === 'function') {
                const beefPayload = payment.beefPayload;
                if (!beefPayload ||
                    !Array.isArray(beefPayload.atomicBeef) ||
                    !beefPayload.atomicBeef.length) {
                    btmsDebug(`${callId}: wallet import skipped — missing beefPayload.atomicBeef`, { payment });
                }
                else {
                    btmsDebug(`${callId}: calling wallet.submitDirectTransaction(...)`);
                    await wallet.submitDirectTransaction({
                        atomicBeef: beefPayload.atomicBeef,
                        outputs: [
                            {
                                vout,
                                basket: this.basket,
                                satoshis: this.satoshis,
                                tags: ['owner self'],
                                customInstructions: JSON.stringify({
                                    sender: payment.sender,
                                    keyID: payment.keyID || 'default',
                                    note,
                                    labels,
                                    assetId: actualAssetId,
                                    amount: parsedAmount
                                })
                            }
                        ]
                    });
                }
            }
            else {
                btmsDebug(`${callId}: wallet.submitDirectTransaction not present — skipping wallet import`);
            }
        }
        catch (err) {
            btmsDebug(`${callId}: wallet submit failed (continuing)`, {
                message: err?.message
            });
        }
        // ---- 8) Finally, ack the message so it disappears from inbox ----
        if (payment?.messageId) {
            await this.tokenator.acknowledgeMessage({ messageIds: [payment.messageId] });
        }
        btmsDebug(`${callId}: done`);
    }
    async refundIncomingTransaction(_assetId, payment) {
        if (payment?.messageId) {
            await this.tokenator.acknowledgeMessage({ messageIds: [payment.messageId] });
        }
    }
    /**
     * Send a BTMS-style payment/message to another identity via message-box-client.
     * Hydration order: LookupResolver (Meter default) -> HTTP LARS (localhost:8080).
     * Requires a non-empty AtomicBEEF (number[]/Uint8Array) OR resolves {txid,vout}
     * automatically from the selected token (no UI txid/vout fields needed).
     */
    async send(...raw) {
        // ---------- helpers ----------
        const isAtomicBEEFArray = (bp) => (Array.isArray(bp) && bp.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) ||
            (bp instanceof Uint8Array && bp.length > 0);
        const isNonEmptyBeef = (bp) => {
            if (!bp)
                return false;
            if (isAtomicBEEFArray(bp))
                return bp.length > 0;
            if (bp instanceof ArrayBuffer)
                return bp.byteLength > 0;
            return false;
        };
        const toNumberArray = (bp) => {
            if (!bp)
                return [];
            if (bp instanceof Uint8Array)
                return Array.from(bp);
            if (bp instanceof ArrayBuffer)
                return Array.from(new Uint8Array(bp));
            if (Array.isArray(bp))
                return bp;
            return [];
        };
        const normHex = (h) => (h ? h.toLowerCase() : '');
        // helper to scan wallet outputs for a token by assetId if no outpoint was provided
        const findOutpointForAsset = async (assetId) => {
            const callId = makeDebugCallId('findOutpointForAsset');
            btmsDebug(`${callId}: start`, { assetId });
            if (!assetId) {
                btmsDebug(`${callId}: no assetId provided`);
                return null;
            }
            try {
                const wallet = walletClient;
                let outs = [];
                // New-world path
                if (typeof wallet.listOutputs === 'function') {
                    const res = await wallet.listOutputs({
                        basket: this.basket,
                        limit: 500,
                        offset: 0,
                        includeCustomInstructions: true,
                        seekPermission: false
                    });
                    outs = Array.isArray(res?.outputs) ? res.outputs : [];
                    btmsDebug(`${callId}: listOutputs ok`, {
                        count: outs.length,
                        keys: res ? Object.keys(res) : null
                    });
                }
                else {
                    btmsDebug(`${callId}: no listOutputs on wallet`);
                    return null;
                }
                for (const o of outs) {
                    // Script: prefer wallet-provided; otherwise fetch by outpoint
                    let script = extractLockingScriptFromWalletOutput(o);
                    if (!script && o.outpoint) {
                        try {
                            script = await fetchScriptForOutpoint(o.outpoint);
                            if (script)
                                btmsDebug(`${callId}: fetched script via overlay`, { outpoint: o.outpoint });
                        }
                        catch (e) {
                            btmsDebug(`${callId}: fetchScriptForOutpoint failed`, {
                                outpoint: o.outpoint,
                                message: e?.message
                            });
                        }
                    }
                    // Decode token metadata from script or customInstructions
                    const decoded = (script ? decodeBTMSTokenFromScript(script) : null) ||
                        decodeBTMSTokenFromCustomInstructions(o.customInstructions);
                    if (!decoded)
                        continue;
                    if (decoded.assetId !== assetId)
                        continue;
                    // Return outpoint in whichever shape we have
                    if (typeof o.outpoint === 'string') {
                        const { txid, vout } = parseOutpoint(o.outpoint);
                        if (txid && Number.isFinite(vout)) {
                            btmsDebug(`${callId}: match via outpoint string`, { txid, vout });
                            return { txid, vout };
                        }
                    }
                    const txid = normHex(o.txid || '');
                    const vout = Number(o.vout);
                    if (txid && Number.isFinite(vout)) {
                        btmsDebug(`${callId}: match via txid/vout fields`, { txid, vout });
                        return { txid, vout };
                    }
                }
                btmsDebug(`${callId}: no match found for assetId`, { assetId });
                return null;
            }
            catch (e) {
                btmsDebug(`${callId}: error`, { message: e?.message, stackTop: String(e?.stack || '').split('\n')[0] });
                return null;
            }
        };
        // ---------- 1) normalize args ----------
        let args;
        if (raw.length === 1 && typeof raw[0] === 'object' && raw[0] !== null) {
            args = raw[0];
        }
        else {
            const [assetId, recipientMaybe, amountMaybe, messageBox] = raw;
            args = {
                assetId,
                amount: typeof amountMaybe === 'string' ? Number(amountMaybe) : amountMaybe,
                recipient: recipientMaybe,
                recipientIdentityKey: recipientMaybe,
                identityKey: recipientMaybe,
                messageBox
            };
        }
        // ---------- 2) pick recipient ----------
        const candidateRecipients = [
            args.recipient,
            args.recipientIdentityKey,
            args.identityKey,
            args.recipientKey,
            args.to,
            args.target
        ];
        const recipient = candidateRecipients
            .filter((x) => typeof x === 'string')
            .map((x) => x.trim())
            .find((s) => !!s && s.length > 0);
        if (!recipient) {
            btmsDebug('[BTMS.send] missing recipient', { keys: Object.keys(args || {}) });
            throw new Error('BTMS.send: recipient is required');
        }
        // ---------- 3) pull out non-nested ----------
        const { messageBox, recipient: _r1, recipientIdentityKey: _r2, identityKey: _r3, ...rest } = args;
        // Accept outpoint provided in several shapes (selected token row)
        const fromArgOutpoint = parseOutpoint(rest.outpoint ||
            rest.selectedOutput?.outpoint ||
            rest?.token?.outpoint);
        // Allow token.txid/vout as a source of outpoint
        const tokenTxid = normHex(rest?.token?.txid);
        const tokenVout = Number(rest?.token?.vout);
        let txidNorm = normHex(rest.txid || tokenTxid || fromArgOutpoint.txid);
        let voutNorm = Number.isFinite(Number(rest.vout))
            ? Number(rest.vout)
            : (Number.isFinite(fromArgOutpoint.vout) ? fromArgOutpoint.vout : tokenVout);
        let haveOutpoint = !!txidNorm && Number.isFinite(voutNorm) && voutNorm >= 0 && Number.isInteger(voutNorm);
        // NEW: if no outpoint was supplied, auto-pick from wallet using selected assetId
        if (!haveOutpoint && rest.assetId) {
            const picked = await findOutpointForAsset(rest.assetId);
            if (picked) {
                txidNorm = normHex(picked.txid);
                voutNorm = picked.vout;
                haveOutpoint = true;
                btmsDebug('[BTMS.send] auto-selected outpoint from wallet outputs', {
                    assetId: rest.assetId,
                    txid: txidNorm,
                    vout: voutNorm
                });
            }
        }
        btmsDebug('[BTMS.send] args summary', {
            recipient,
            assetId: rest.assetId,
            amount: rest.amount,
            haveOutpoint,
            txid: txidNorm,
            vout: voutNorm,
            hasBeefPayloadField: !!rest.beefPayload
        });
        // ---------- 4) hydrate AtomicBEEF using LookupResolver first, HTTP LARS second ----------
        let beefPayload = rest.beefPayload ??
            rest.beef ??
            rest?.token?.beef ??
            rest?.token?.beefPayload ??
            null;
        // Absolute overlay base ONLY (never relative); env override supported
        const OVERLAY_BASE = window.__BTMS_OVERLAY_BASE__ ||
            (typeof process !== 'undefined' && process?.env?.BTMS_OVERLAY_URL) ||
            ((typeof location !== 'undefined' && location.hostname === 'localhost')
                ? 'http://localhost:8080'
                : 'https://overlay-eu-1.bsvb.tech');
        // Guards against common misconfigs (webpack origin / ephemeral localhost-####)
        if (/8093\b/.test(String(OVERLAY_BASE))) {
            throw new Error('Misconfigured OVERLAY_BASE: 8093 is the webpack dev server, not LARS (8080).');
        }
        if (/^https?:\/\/localhost-\d+/.test(String(OVERLAY_BASE))) {
            throw new Error(`Misconfigured OVERLAY_BASE: "${OVERLAY_BASE}" looks like a transient dev host, not LARS.`);
        }
        if (!/^https?:\/\//.test(String(OVERLAY_BASE))) {
            throw new Error(`OVERLAY_BASE must be absolute (got "${OVERLAY_BASE}")`);
        }
        btmsDebug('[BTMS.send] overlay config', { OVERLAY_BASE, haveOutpoint });
        const fetchFromResolver = async (txid, vout) => {
            try {
                const lr = this.lookupResolver;
                if (!lr) {
                    btmsDebug('[BTMS.send] no LookupResolver present');
                    return null;
                }
                btmsDebug('[BTMS.send] resolver.lookup start', { txid, vout });
                let res = null;
                if (typeof lr.lookup === 'function') {
                    res = await lr.lookup({ service: 'ls_btms', query: { txid, vout } });
                }
                else if (typeof lr.find === 'function') {
                    res = await lr.find('ls_btms', { txid, vout });
                }
                else if (typeof lr.search === 'function') {
                    res = await lr.search('ls_btms', { txid, vout });
                }
                else {
                    btmsDebug('[BTMS.send] resolver has no lookup/find/search');
                }
                const outList = Array.isArray(res) ? res : res?.outputs;
                btmsDebug('[BTMS.send] resolver.lookup result keys', {
                    isArray: Array.isArray(res),
                    keys: res ? Object.keys(res) : null,
                    hasOutputs: !!outList,
                    outputsLen: Array.isArray(outList) ? outList.length : null
                });
                // Accept beef-like fields on array form
                if (Array.isArray(outList) && outList.length) {
                    const cand = outList[0] || {};
                    const beefLike = (Array.isArray(cand.beef) && cand.beef) ||
                        (Array.isArray(cand.context) && cand.context) ||
                        (Array.isArray(cand.atomicBEEF) && cand.atomicBEEF) ||
                        (Array.isArray(cand.beefPayload) && cand.beefPayload);
                    btmsDebug('[BTMS.send] resolver.lookup array candidate', {
                        usedField: Array.isArray(cand.beef)
                            ? 'beef'
                            : Array.isArray(cand.context)
                                ? 'context'
                                : Array.isArray(cand.atomicBEEF)
                                    ? 'atomicBEEF'
                                    : Array.isArray(cand.beefPayload)
                                        ? 'beefPayload'
                                        : 'none',
                        len: Array.isArray(beefLike) ? beefLike.length : 0
                    });
                    if (Array.isArray(beefLike) && beefLike.length) {
                        return Uint8Array.from(beefLike);
                    }
                }
                // Accept beef-like fields on output-list shape
                if (res && res.type === 'output-list' && Array.isArray(res.outputs) && res.outputs.length) {
                    const out = res.outputs[0] || {};
                    const beefLike = (Array.isArray(out.beef) && out.beef) ||
                        (Array.isArray(out.context) && out.context);
                    btmsDebug('[BTMS.send] resolver.lookup output-list candidate', {
                        usedField: Array.isArray(out.beef)
                            ? 'beef'
                            : Array.isArray(out.context)
                                ? 'context'
                                : 'none',
                        len: Array.isArray(beefLike) ? beefLike.length : 0
                    });
                    if (Array.isArray(beefLike) && beefLike.length) {
                        return Uint8Array.from(beefLike);
                    }
                }
                return null;
            }
            catch (e) {
                btmsDebug('[BTMS.send] resolver path error', { msg: e?.message, stack: e?.stack });
                return null;
            }
        };
        const fetchFromHTTP = async (txid, vout) => {
            const base = String(OVERLAY_BASE).replace(/\/+$/, '');
            const url = `${base}/lookup`;
            const body = { service: 'ls_btms', query: { txid, vout } }; // correct key: service
            btmsDebug('[BTMS.send] HTTP /lookup POST', { url, body });
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body)
            });
            const text = await r.text().catch(() => '');
            btmsDebug('[BTMS.send] HTTP /lookup response', {
                ok: r.ok,
                status: r.status,
                statusText: r.statusText,
                preview: text.slice(0, 200)
            });
            if (!r.ok) {
                throw new Error(`HTTP overlay lookup failed: ${r.status} ${r.statusText} ${text.slice(0, 200)}`);
            }
            const j = text ? JSON.parse(text) : null;
            // Root-level beef/context
            if (j && Array.isArray(j.beef) && j.beef.length)
                return Uint8Array.from(j.beef);
            if (j && Array.isArray(j.context) && j.context.length)
                return Uint8Array.from(j.context);
            // Single-output object with beef/context
            if (j && j.output) {
                if (Array.isArray(j.output.beef) && j.output.beef.length) {
                    return Uint8Array.from(j.output.beef);
                }
                if (Array.isArray(j.output.context) && j.output.context.length) {
                    return Uint8Array.from(j.output.context);
                }
            }
            // output-list shape with beef/context
            if (j && j.type === 'output-list' && Array.isArray(j.outputs) && j.outputs.length) {
                const out = j.outputs[0];
                if (Array.isArray(out.beef) && out.beef.length)
                    return Uint8Array.from(out.beef);
                if (Array.isArray(out.context) && out.context.length)
                    return Uint8Array.from(out.context);
            }
            return null;
        };
        if (!isNonEmptyBeef(beefPayload) && haveOutpoint) {
            // 4a) Try resolver (Meter default)
            beefPayload = await fetchFromResolver(txidNorm, voutNorm);
            // 4b) Fallback to HTTP LARS
            if (!isNonEmptyBeef(beefPayload)) {
                btmsDebug('[BTMS.send] resolver empty, trying HTTP', { txid: txidNorm, vout: voutNorm });
                beefPayload = await fetchFromHTTP(txidNorm, voutNorm);
            }
            if (isNonEmptyBeef(beefPayload) && rest.amount == null) {
                btmsDebug('[BTMS.send] hydrated AtomicBEEF', {
                    txid: txidNorm,
                    vout: voutNorm,
                    beefLen: beefPayload instanceof Uint8Array
                        ? beefPayload.length
                        : Array.isArray(beefPayload)
                            ? beefPayload.length
                            : 0
                });
            }
        }
        // ---------- 5) require non-empty beef ----------
        const beefArray = toNumberArray(beefPayload);
        btmsDebug('[BTMS.send] final beef check', {
            haveOutpoint,
            txid: txidNorm,
            vout: voutNorm,
            beefType: beefPayload ? (beefPayload.constructor?.name || typeof beefPayload) : 'null',
            beefLen: beefArray.length
        });
        if (!beefArray.length) {
            throw new Error(`BTMS.send: beefPayload empty. Overlay base=${OVERLAY_BASE}, haveOutpoint=${haveOutpoint}, txid=${txidNorm || ''}, vout=${Number.isFinite(voutNorm) ? voutNorm : 'NaN'}. ` +
                `Pass a selected token (assetId) or ensure ls_btms is running and admitted the tx.`);
        }
        // ---------- 6) final body (JSON-serializable) ----------
        const body = {
            ...rest,
            token: rest.token ??
                {
                    txid: txidNorm || '',
                    vout: Number.isFinite(voutNorm) ? voutNorm : 0,
                    amount: typeof rest.amount === 'number' ? rest.amount : 0,
                    assetId: rest.assetId,
                    beef: beefArray,
                    beefPayload: beefArray,
                    keyID: rest.keyID ?? 'default',
                    outputScript: rest.outputScript ?? '' // optional
                },
            beef: beefArray,
            beefPayload: beefArray
        };
        btmsDebug('[BTMS.send] about to send message', {
            recipient,
            messageBox: messageBox || this.tokensMessageBox,
            bodyKeys: Object.keys(body),
            beefLen: beefArray.length
        });
        // ---------- 7) send ----------
        await this.tokenator.sendMessage({
            recipient,
            messageBox: messageBox || this.tokensMessageBox,
            body
        });
        btmsDebug('[BTMS.send] message sent OK', {
            recipient,
            txid: body.token.txid,
            vout: body.token.vout,
            beefLen: beefArray.length
        });
    }
    async findFromTokenOverlay(token) {
        // 1) Try the resolver path (Meter-style)
        try {
            const network = (await walletClient.getNetwork()).network;
            const preset = typeof location !== 'undefined' && location.hostname === 'localhost'
                ? 'local'
                : network;
            const resolver = new sdk_2.LookupResolver({ networkPreset: preset });
            const lookupResult = await resolver.query({
                service: 'ls_btms',
                query: { txid: token.txid, vout: token.vout }
            });
            const outputs = lookupResult?.type === 'output-list'
                ? lookupResult.outputs
                : lookupResult?.type === 'output' && lookupResult.output
                    ? [lookupResult.output]
                    : [];
            if (!outputs.length) {
                throw new Error('ls_btms returned no outputs');
            }
            const normalized = outputs.flatMap((out) => {
                try {
                    // Expect resolver shape: { beef:number[], outputIndex:number, context?:number[] }
                    const beef = out.beef;
                    const vout = Number(out.outputIndex ?? out.vout ?? token.vout);
                    const tx = sdk_1.Transaction.fromAtomicBEEF(beef);
                    const txid = tx.id('hex');
                    const o = tx.outputs[vout];
                    if (!o)
                        return [];
                    const outputScript = o.lockingScript.toHex();
                    const satoshis = o.satoshis ?? 0;
                    return [
                        {
                            txid,
                            vout,
                            // Store atomic BEEF hex for downstream consumers that expect a string
                            rawTx: sdk_1.Utils.toHex(tx.toAtomicBEEF()),
                            outputScript,
                            satoshis,
                            inputs: null,
                            mapiResponses: null,
                            proof: out.context ?? null
                        }
                    ];
                }
                catch {
                    return [];
                }
            });
            if (normalized.length === 0) {
                throw new Error('No parsable outputs from ls_btms');
            }
            return normalized;
        }
        catch (err) {
            btmsDebug('findFromTokenOverlay: resolver path failed, will try HTTP', {
                message: err?.message,
                txid: token.txid,
                vout: token.vout
            });
        }
        // 2) Fallback HTTP (Overlay Engine on 8080; body uses {service, query})
        const overlayUrl = 'http://localhost:8080/lookup';
        const body = {
            service: 'ls_btms',
            query: { txid: token.txid, vout: token.vout }
        };
        try {
            const res = await this.requester(overlayUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                btmsDebug('findFromTokenOverlay: HTTP non-OK', {
                    status: res.status,
                    txid: token.txid,
                    vout: token.vout
                });
                return [];
            }
            const json = (await res.json());
            // If the HTTP path also returns the modern 'output-list', normalize it the same way.
            if (json?.type === 'output-list' && Array.isArray(json.outputs)) {
                const normalized = json.outputs.flatMap((out) => {
                    try {
                        const beef = out.beef;
                        const vout = Number(out.outputIndex ?? out.vout ?? token.vout);
                        const tx = sdk_1.Transaction.fromAtomicBEEF(beef);
                        const txid = tx.id('hex');
                        const o = tx.outputs[vout];
                        if (!o)
                            return [];
                        return [
                            {
                                txid,
                                vout,
                                rawTx: sdk_1.Utils.toHex(tx.toAtomicBEEF()),
                                outputScript: o.lockingScript.toHex(),
                                satoshis: o.satoshis ?? 0,
                                inputs: null,
                                mapiResponses: null,
                                proof: out.context ?? null
                            }
                        ];
                    }
                    catch {
                        return [];
                    }
                });
                return normalized;
            }
            // Legacy shapes (array/object). Keep your old tolerant behavior.
            if (Array.isArray(json))
                return json;
            if (json && typeof json === 'object')
                return [json];
            return [];
        }
        catch (err) {
            btmsDebug('findFromTokenOverlay: HTTP path failed', {
                message: err?.message,
                txid: token.txid,
                vout: token.vout
            });
            return [];
        }
    }
    async submitToTokenOverlay(tx, topics = [this.tokenTopic]) {
        // 1) try SHIP if we have something tx-like
        try {
            const atomic = tx?.tx ||
                tx?.atomicBeef ||
                tx?.beef ||
                tx?.rawTx;
            if (atomic) {
                const facilitator = new sdk_1.HTTPSOverlayBroadcastFacilitator(fetch, true);
                facilitator.allowHTTP = true;
                const broadcaster = new sdk_1.SHIPBroadcaster(topics, {
                    networkPreset: 'local',
                    facilitator,
                    requireAcknowledgmentFromAnyHostForTopics: 'any'
                });
                const t = sdk_1.Transaction.fromAtomicBEEF(atomic);
                await broadcaster.broadcast(t);
                // fabricate a SubmitResult so callers get the shape they expect
                return {
                    status: 'success',
                    topics: {
                        [topics[0]]: [0]
                    }
                };
            }
        }
        catch (err) {
            btmsDebug('submitToTokenOverlay: SHIP path failed, falling back to HTTP', {
                message: err?.message
            });
            // fall through to HTTP
        }
        // 2) HTTP fallback — this matches the overlay you’ve been curling
        const overlayUrl = 'http://localhost:8080/submit';
        const body = {
            ...tx,
            topics,
            provider: 'tm_btms'
        };
        const res = await this.requester(overlayUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // your node wanted this:
                'x-topics': JSON.stringify(topics)
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            btmsDebug('submitToTokenOverlay: HTTP non-OK', {
                status: res.status,
                text
            });
            throw new Error(`Overlay submit failed: ${res.status}`);
        }
        const json = (await res.json());
        btmsDebug('submitToTokenOverlay: HTTP success', json);
        return json;
    }
    async issue(...rawArgs) {
        // legacy positional
        if (rawArgs.length && typeof rawArgs[0] !== 'object') {
            const [amountMaybe, nameOrAssetId, metadataMaybe] = rawArgs;
            const amount = Number(amountMaybe ?? 1);
            const assetId = nameOrAssetId || `asset_${Math.random().toString(36).slice(2, 10)}`;
            const normalizedMetadata = typeof metadataMaybe === 'string'
                ? metadataMaybe
                : JSON.stringify(metadataMaybe ?? {});
            const tok = new BTMSToken();
            const lockingScriptObj = await tok.lock(this.protocolID, 'default', 'self', assetId, amount, normalizedMetadata, false);
            const outputScript = typeof lockingScriptObj.toHex === 'function'
                ? lockingScriptObj.toHex()
                : String(lockingScriptObj);
            btmsDebug('issue(positional) prepared lockingScript:', {
                isHex: isLikelyHex(outputScript),
                preview: shortHex(outputScript, 32),
                length: outputScript?.length
            });
            // canonical BTMS beefPayload we want associated with this output
            const beefPayload = {
                protocolID: this.protocolID,
                assetId,
                amount,
                metadata: normalizedMetadata
            };
            const action = await tryWalletMint(outputScript, this.basket, this.satoshis, `Mint ${assetId} (${amount})`, beefPayload);
            return {
                outputScript,
                assetId,
                amount,
                metadata: normalizedMetadata,
                beefPayload,
                atomicBeef: action?.tx || action?.atomicBeef || action?.beef || null
            };
        }
        // object style
        const args = (rawArgs[0] || {});
        const { assetId = `asset_${Math.random().toString(36).slice(2, 10)}`, amount = 1, metadata = '', keyID = 'default', counterparty = 'self', forSelf = false } = args;
        const normalizedMetadata = typeof metadata === 'string' ? metadata : JSON.stringify(metadata ?? {});
        const tok = new BTMSToken();
        const lockingScriptObj = await tok.lock(this.protocolID, keyID, counterparty, assetId, amount, normalizedMetadata, forSelf);
        const outputScript = typeof lockingScriptObj.toHex === 'function'
            ? lockingScriptObj.toHex()
            : String(lockingScriptObj);
        btmsDebug('issue(object) prepared lockingScript:', JSON.stringify({
            isHex: isLikelyHex(outputScript),
            preview: shortHex(outputScript, 32),
            length: outputScript?.length
        }));
        const beefPayload = {
            protocolID: this.protocolID,
            assetId,
            amount,
            metadata: normalizedMetadata
        };
        const action = await tryWalletMint(outputScript, this.basket, this.satoshis, `Mint ${assetId} (${amount})`, beefPayload);
        return {
            outputScript,
            assetId,
            amount,
            metadata: normalizedMetadata,
            beefPayload,
            atomicBeef: action?.tx || action?.atomicBeef || action?.beef || null
        };
    }
}
exports.BTMS = BTMS;
/* ------------------------------------------------------------------ */
/* default export                                                     */
/* ------------------------------------------------------------------ */
const btmsInstance = new BTMS();
exports.btms = btmsInstance;
const defaultExport = btmsInstance;
defaultExport.listAssets = btmsInstance.listAssets.bind(btmsInstance);
defaultExport.issue = btmsInstance.issue.bind(btmsInstance);
defaultExport.listIncomingPayments = btmsInstance.listIncomingPayments.bind(btmsInstance);
defaultExport.getPublicKey = btmsInstance.getPublicKey.bind(btmsInstance);
defaultExport.acceptIncomingPayment = btmsInstance.acceptIncomingPayment.bind(btmsInstance);
defaultExport.refundIncomingTransaction = btmsInstance.refundIncomingTransaction.bind(btmsInstance);
defaultExport.send = btmsInstance.send.bind(btmsInstance);
BTMS.listIncomingPayments = btmsInstance.listIncomingPayments.bind(btmsInstance);
btmsDebug('exported singleton btmsInstance', {
    instanceId: btmsInstance.instanceId,
    source: BTMS_SOURCE_TAG
});
// -------------------------------------------------------------------
// helper: sendBTMSToken
// -------------------------------------------------------------------
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
async function sendBTMSToken(rawArgs) {
    const callId = makeDebugCallId('sendBTMSToken');
    btmsDebug(`${callId}: start`, { rawArgs });
    try {
        // Allow being called as sendBTMSToken({ ... }) only.
        const args = rawArgs && typeof rawArgs === 'object' ? { ...rawArgs } : {};
        const { assetId, recipient } = args;
        // Normalise amount
        const amt = typeof args.amount === 'string'
            ? Number(args.amount)
            : args.amount;
        if (!assetId || typeof assetId !== 'string') {
            throw new Error('sendBTMSToken: assetId is required');
        }
        if (!recipient || typeof recipient !== 'string') {
            throw new Error('sendBTMSToken: recipient identity key is required');
        }
        if (!Number.isFinite(amt) || amt <= 0) {
            throw new Error('sendBTMSToken: amount must be a positive number');
        }
        const payload = {
            ...args,
            assetId,
            recipient,
            amount: amt
        };
        btmsDebug(`${callId}: calling btms.send(...)`, {
            assetId,
            recipient,
            amount: amt,
            hasBeefPayload: !!payload.beefPayload,
            hasTokenBeef: !!payload.token?.beef || !!payload.token?.beefPayload
        });
        await btmsInstance.send(payload);
        btmsDebug(`${callId}: btms.send(...) completed`, {
            assetId,
            recipient,
            amount: amt
        });
    }
    catch (err) {
        btmsDebug(`${callId}: ERROR`, {
            message: err?.message,
            stackTop: String(err?.stack || '').split('\n')[0]
        });
        throw err;
    }
}
exports.sendBTMSToken = sendBTMSToken;
exports.default = defaultExport;
