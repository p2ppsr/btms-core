// Updated Basic Token Management System (BTMS) library
// Aligned with WalletInterface types for improved specificity and compatibility
// This file incorporates refined types such as HexString, PositiveInteger, SatoshiValue, etc.
// Structures like CreateActionOutput, BeefPayload, CreateActionInput, and SpecificKeyLinkageResult have been updated as per analysis
// Imports from '@bsv/sdk' for core Bitcoin types
// Legacy JS deps that don't ship .d.ts files.
// We just suppress them here so VS Code / tsc stop yelling.
// This keeps everything in THIS file, per instructions.
import crypto from "crypto";
// @ts-ignore -- JS lib, no types
import stringify from "json-stable-stringify";
// primitives that DO exist in @bsv/sdk 1.8.11
import {
  BigNumber,
  Curve,
  LockingScript,
  P2PKH,
  PrivateKey,
  PublicKey,
  ScriptTemplate,
  OP,
  UnlockingScript,
  TransactionSignature,
  Signature,
  Hash,
  Utils,
  PushDrop,
  WalletClient,
  SHIPBroadcaster,
  HTTPSOverlayBroadcastFacilitator,
  LookupResolver,
  AtomicBEEF,
  InternalizeOutput,
  Beef,
  WalletPayment,
  TXIDHexString,
  LabelStringUnder300Bytes,
  HexString,
  OutputTagStringUnder300Bytes,
  Transaction,
  BooleanDefaultFalse,
  Byte,
  OutpointString,
  DescriptionString5to50Bytes,
  BasketStringUnder300Bytes,
  SatoshiValue,
  CertificateFieldNameUnder50Bytes,
  PubKeyHex,
  Base64String,
  WalletProtocol,
  KeyIDStringUnder800Bytes,
  WalletCounterparty,
  OriginatorDomainNameStringUnder250Bytes,
} from "@bsv/sdk";
// use the shared logger (so logging.config.ts can turn this on/off)
import { logWithTimestamp } from "../utils/logging";
import { MessageBoxClient } from "@bsv/message-box-client";

// Custom primitive types for better type safety
type PositiveInteger = number & { __brand: "PositiveInteger" }; // Positive integer (branded for safety)
type PositiveIntegerOrZero = number & { __brand: "PositiveIntegerOrZero" }; // Non-negative integer

// ---------------------------------------------------------------------
// Additional extracted and updated interfaces from analysis
// ---------------------------------------------------------------------

interface WalletAction {
  txid: TXIDHexString;
  satoshis: SatoshiValue;
  status: string; // ActionStatus (e.g., 'pending', 'completed')
  isOutgoing: boolean;
  description: DescriptionString5to50Bytes;
  labels?: LabelStringUnder300Bytes[];
  version: PositiveIntegerOrZero;
  lockTime: PositiveIntegerOrZero;
  inputs?: WalletActionInput[];
  outputs?: WalletActionOutput[];
}

interface WalletActionInput {
  sourceOutpoint: OutpointString;
  sourceSatoshis: SatoshiValue;
  sourceLockingScript?: HexString;
  unlockingScript?: HexString;
  inputDescription: DescriptionString5to50Bytes;
  sequenceNumber: PositiveIntegerOrZero;
}

interface WalletActionOutput {
  satoshis: SatoshiValue;
  lockingScript?: HexString;
  spendable: boolean;
  customInstructions?: string;
  tags: OutputTagStringUnder300Bytes[];
  outputIndex: PositiveIntegerOrZero;
  outputDescription: DescriptionString5to50Bytes;
  basket: BasketStringUnder300Bytes;
}

interface WalletCertificate {
  type: Base64String;
  subject: PubKeyHex;
  serialNumber: Base64String;
  certifier: PubKeyHex;
  revocationOutpoint: OutpointString;
  signature: HexString;
  fields: Record<CertificateFieldNameUnder50Bytes, string>;
}

interface WalletOutput {
  satoshis: SatoshiValue;
  lockingScript?: HexString;
  spendable: boolean;
  customInstructions?: string;
  tags?: OutputTagStringUnder300Bytes[];
  outpoint: OutpointString;
  labels?: LabelStringUnder300Bytes[];
}

// Placeholder for other args/results (updated with refined types where applicable)
interface CreateActionArgs {
  // Example: inputs: CreateActionInput[], outputs: CreateActionOutput[]
  // Add as needed
}

interface SignActionArgs {}
interface SignActionResult {}
interface AbortActionArgs {}
interface AbortActionResult {}
interface ListActionsArgs {}
interface ListActionsResult {
  actions: WalletAction[];
}
// NOTE: we now use SDKInternalizeActionArgs / SDKInternalizeActionResult for
// real calls; these placeholders are only for the Wallet interface shape.
interface InternalizeActionArgs {}
interface InternalizeActionResult {}
interface ListOutputsArgs {}
interface ListOutputsResult {
  outputs: WalletOutput[];
}
interface RelinquishOutputArgs {}
interface RelinquishOutputResult {}
interface AcquireCertificateArgs {}
interface AcquireCertificateResult {
  certificate: WalletCertificate;
}
interface ListCertificatesArgs {}
interface ListCertificatesResult {
  certificates: WalletCertificate[];
}
interface ProveCertificateArgs {}
interface ProveCertificateResult {}
interface RelinquishCertificateArgs {}
interface RelinquishCertificateResult {}
interface DiscoverByIdentityKeyArgs {}
interface DiscoverCertificatesResult {}
interface DiscoverByAttributesArgs {}
interface AuthenticatedResult {
  authenticated: boolean;
}
interface GetHeightResult {
  height: PositiveInteger;
}
interface GetHeaderArgs {}
interface GetHeaderResult {
  header: HexString;
}
interface GetNetworkResult {
  network: string;
}
interface GetVersionResult {
  version: string;
}

// Crypto-related args/results
interface GetPublicKeyArgs {}
interface GetPublicKeyResult {
  publicKey: PubKeyHex;
}
interface RevealCounterpartyKeyLinkageArgs {}
interface RevealCounterpartyKeyLinkageResult {}
interface RevealSpecificKeyLinkageArgs {}
interface RevealSpecificKeyLinkageResult extends SpecificKeyLinkageResult {}
interface WalletEncryptArgs extends WalletEncryptionArgs {
  plaintext: Byte[];
}
interface WalletEncryptResult {
  ciphertext: Byte[];
}
interface WalletDecryptArgs extends WalletEncryptionArgs {
  ciphertext: Byte[];
}
interface WalletDecryptResult {
  plaintext: Byte[];
}
interface CreateHmacArgs extends WalletEncryptionArgs {
  data: Byte[];
}
interface CreateHmacResult {
  hmac: Byte[];
}
interface VerifyHmacArgs extends WalletEncryptionArgs {
  data: Byte[];
  hmac: Byte[];
}
interface VerifyHmacResult {
  valid: boolean;
}
interface CreateSignatureArgs extends WalletEncryptionArgs {
  data?: Byte[];
  hashToDirectlyVerify?: Byte[];
  forSelf?: BooleanDefaultFalse;
}
interface CreateSignatureResult {
  signature: Byte[];
}
interface VerifySignatureArgs extends WalletEncryptionArgs {
  data?: Byte[];
  hashToDirectlyVerify?: Byte[];
  signature: Byte[];
  forSelf?: BooleanDefaultFalse;
}
interface VerifySignatureResult {
  valid: boolean;
}

// Common encryption args
interface WalletEncryptionArgs {
  protocolID: WalletProtocol;
  keyID: KeyIDStringUnder800Bytes;
  counterparty?: WalletCounterparty;
  privileged?: BooleanDefaultFalse;
  privilegedReason?: DescriptionString5to50Bytes;
  seekPermission?: boolean; // Default true
}

// WalletCryptoObject interface (updated)
interface WalletCryptoObject {
  getPublicKey: (
    args: GetPublicKeyArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<GetPublicKeyResult>;
  revealCounterpartyKeyLinkage: (
    args: RevealCounterpartyKeyLinkageArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<RevealCounterpartyKeyLinkageResult>;
  revealSpecificKeyLinkage: (
    args: RevealSpecificKeyLinkageArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<RevealSpecificKeyLinkageResult>;
  encrypt: (
    args: WalletEncryptArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<WalletEncryptResult>;
  decrypt: (
    args: WalletDecryptArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<WalletDecryptResult>;
  createHmac: (
    args: CreateHmacArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<CreateHmacResult>;
  verifyHmac: (
    args: VerifyHmacArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<VerifyHmacResult>;
  createSignature: (
    args: CreateSignatureArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<CreateSignatureResult>;
  verifySignature: (
    args: VerifySignatureArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<VerifySignatureResult>;
}

// Main Wallet interface (extended and updated)
interface Wallet extends WalletCryptoObject {
  createAction: (
    args: CreateActionArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<CreateActionResult>;
  signAction: (
    args: SignActionArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<SignActionResult>;
  abortAction: (
    args: AbortActionArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<AbortActionResult>;
  listActions: (
    args: ListActionsArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<ListActionsResult>;
  internalizeAction: (
    args: InternalizeActionArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<InternalizeActionResult>;
  listOutputs: (
    args: ListOutputsArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<ListOutputsResult>;
  relinquishOutput: (
    args: RelinquishOutputArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<RelinquishOutputResult>;
  acquireCertificate: (
    args: AcquireCertificateArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<AcquireCertificateResult>;
  listCertificates: (
    args: ListCertificatesArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<ListCertificatesResult>;
  proveCertificate: (
    args: ProveCertificateArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<ProveCertificateResult>;
  relinquishCertificate: (
    args: RelinquishCertificateArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<RelinquishCertificateResult>;
  discoverByIdentityKey: (
    args: DiscoverByIdentityKeyArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<DiscoverCertificatesResult>;
  discoverByAttributes: (
    args: DiscoverByAttributesArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<DiscoverCertificatesResult>;
  isAuthenticated: (
    args: {},
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<AuthenticatedResult>;
  waitForAuthentication: (
    args: {},
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<AuthenticatedResult>;
  getHeight: (
    args: {},
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<GetHeightResult>;
  getHeaderForHeight: (
    args: GetHeaderArgs,
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<GetHeaderResult>;
  getNetwork: (
    args: {},
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<GetNetworkResult>;
  getVersion: (
    args: {},
    originator?: OriginatorDomainNameStringUnder250Bytes,
  ) => Promise<GetVersionResult>;
}

/**
 * Global debug switch. Leave on while we’re chasing the repeated calls.
 */
const BTMS_DEBUG = true;

/**
 * A stable tag so we can see WHICH version of this file is being executed
 * after hot-reloads / re-bundles.
 */
const BTMS_SOURCE_TAG = "frontend/src/btms/index.ts@debug-hmr-05";

/**
 * Simple wrapper so all BTMS debug lines have a consistent prefix.
 */
function btmsDebug(label: string, ...rest: any[]) {
  if (!BTMS_DEBUG) return;
  logWithTimestamp(`[BTMS:${BTMS_SOURCE_TAG}] ${label}`, ...rest);
}

/**
 * per-call id so we can correlate
 */
function makeDebugCallId(prefix = "call"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

const ANYONE =
  "0000000000000000000000000000000000000000000000000000000000000001";

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
  tags?: OutputTagStringUnder300Bytes[];
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

/* ------------------------------------------------------------------ */
/* small helpers */
/* ------------------------------------------------------------------ */
// pull the pubkey and the data fields out of a BTMS-style locking script
function parseBTMSScriptFull(scriptHex: string): {
  lockingPublicKey?: PubKeyHex;
  assetId?: string;
  amount?: SatoshiValue;
  metadata?: string;
} {
  if (!scriptHex || typeof scriptHex !== "string") return {};
  const lower = scriptHex.toLowerCase();
  let lockingPublicKey: PubKeyHex | undefined;
  // legacy BTMS script is: 21 <33-byte pubkey> ac <push assetId> <push amount> <push metadata> ... drops
  if (lower.startsWith("21") && lower.length > 70) {
    // after "21" we have 33 bytes (66 hex)
    lockingPublicKey = lower.slice(2, 68) as PubKeyHex;
  }
  const decoded = decodeBTMSTokenFromScript(lower);
  return {
    lockingPublicKey,
    assetId: decoded?.assetId,
    amount: decoded?.amount,
    metadata: decoded?.metadata,
  };
}

function shortHex(hex?: string | null, len = 16): string {
  if (!hex || typeof hex !== "string") return String(hex);
  const h = hex.toLowerCase();
  return h.length <= len ? h : `${h.slice(0, len)}…(${h.length})`;
}

function isLikelyHex(s: any): boolean {
  return typeof s === "string" && /^[0-9a-fA-F]+$/.test(s);
}

/**
 * Global, optional, app-provided authenticated fetch.
 */
let activeAuthFetch:
  | ((url: string, init?: RequestInit) => Promise<Response>)
  | null = null;

function setBTMSAuthFetch(
  fn: (url: string, init?: RequestInit) => Promise<Response>,
) {
  activeAuthFetch = fn;
}

async function fetchJSON<T = unknown>(
  url: string,
  opts: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for ${url}: ${text}`);
  }
  return (await res.json()) as T;
}

function makeId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ */
/* wallet client we already have */
/* ------------------------------------------------------------------ */
/**
 * Concrete runtime type for the WalletClient instance, merged with
 * your WalletInterface spec so we get proper listOutputs/internalizeAction
 * typings instead of any/namespace hacks.
 */
const walletClient = new WalletClient();
//const WALLET_BASE = 'http://localhost:3321'
//const walletClient = new WalletClient('json-api', WALLET_BASE)
void walletClient
  .getPublicKey({ identityKey: true })
  .then((pk: any) => btmsDebug("wallet.getPublicKey(identity):", pk))
  .catch((e: any) => btmsDebug("wallet.getPublicKey failed:", e));

const OVERLAY_BASE =
  (typeof window !== "undefined" && (window as any).__BTMS_OVERLAY_BASE__) ||
  (typeof process !== "undefined" && (process as any).env?.BTMS_OVERLAY_URL) ||
  (typeof location !== "undefined" && location.hostname === "localhost"
    ? "http://localhost:8080"
    : "https://overlay-eu-1.bsvb.tech");

/* ------------------------------------------------------------------ */
/* script extraction from a wallet-output object */
/* ------------------------------------------------------------------ */
function extractLockingScriptFromWalletOutput(o: any): string {
  if (!o || typeof o !== "object") return "";
  if (typeof o.lockingScript === "string" && o.lockingScript)
    return o.lockingScript;
  if (typeof o.script === "string" && o.script) return o.script;
  const envOut = o.beefPayload?.outputs?.[0];
  if (envOut) {
    if (typeof envOut.lockingScript === "string" && envOut.lockingScript) {
      return envOut.lockingScript;
    }
    if (typeof envOut.script === "string" && envOut.script) {
      return envOut.script;
    }
  }
  const outs0 = o.outputs?.[0];
  if (outs0) {
    if (typeof outs0.lockingScript === "string" && outs0.lockingScript) {
      return outs0.lockingScript;
    }
    if (typeof outs0.script === "string" && outs0.script) {
      return outs0.script;
    }
  }
  const outObj = o.output;
  if (outObj) {
    if (typeof outObj.lockingScript === "string" && outObj.lockingScript) {
      return outObj.lockingScript;
    }
    if (typeof outObj.script === "string" && outObj.script) {
      return outObj.script;
    }
  }
  return "";
}

/* ------------------------------------------------------------------ */
/* if we only have an outpoint, try to fetch script from wallet HTTP */
/* ------------------------------------------------------------------ */
function parseOutpoint(s?: string): { txid: TXIDHexString; vout: number } {
  if (!s || typeof s !== "string")
    return { txid: "" as TXIDHexString, vout: NaN };
  const sep = s.includes(".")
    ? "."
    : s.includes(":")
      ? ":"
      : s.includes("-")
        ? "-"
        : "";
  if (!sep) return { txid: "" as TXIDHexString, vout: NaN };
  const [t, v] = s.split(sep);
  return { txid: (t || "").toLowerCase() as TXIDHexString, vout: Number(v) };
}

async function fetchScriptForOutpoint(outpoint: string): Promise<string> {
  // Legacy helper: in the old world this tried wallet/overlay HTTP lookups.
  // In the new world, WalletClient.listOutputs is the ONLY source of scripts,
  // so this is now just a parser + debug stub that always returns ''.
  let txid = "";
  let voutStr = "";
  if (outpoint.includes(".")) {
    [txid, voutStr] = outpoint.split(".");
  } else if (outpoint.includes(":")) {
    [txid, voutStr] = outpoint.split(":");
  } else if (outpoint.includes("-")) {
    [txid, voutStr] = outpoint.split("-");
  } else {
    if (BTMS_DEBUG) {
      btmsDebug("fetchScriptForOutpoint: unsupported outpoint format (stub)", {
        outpoint,
      });
    }
    return "";
  }
  const vout = Number(voutStr);
  if (!txid || Number.isNaN(vout)) {
    if (BTMS_DEBUG) {
      btmsDebug(
        "fetchScriptForOutpoint: invalid txid/vout parsed from outpoint (stub)",
        {
          outpoint,
          txid,
          voutStr,
        },
      );
    }
    return "";
  }
  if (BTMS_DEBUG) {
    btmsDebug(
      "fetchScriptForOutpoint: stub active; no HTTP/overlay lookup performed",
      {
        outpoint,
        txid,
        vout,
      },
    );
  }
  // If the WalletClient output didn't already include a lockingScript,
  // we currently treat this as plain BSV and do not attempt to fetch a script.
  return "";
}

/* ------------------------------------------------------------------ */
/* BTMS token script decoder */
/* ------------------------------------------------------------------ */
function decodeBTMSTokenFromScript(
  scriptHex: HexString,
): { assetId: string; amount: SatoshiValue; metadata: string } | null {
  if (!scriptHex || typeof scriptHex !== "string") return null;
  let body = scriptHex.toLowerCase();
  if (body.startsWith("21") && body.length > 70) {
    body = body.slice(70);
  } else if (body.startsWith("51")) {
    body = body.slice(2);
  }
  const fields: string[] = [];
  let i = 0;
  while (i < body.length) {
    const opcodeHex = body.slice(i, i + 2);
    if (!opcodeHex) break;
    const opcode = parseInt(opcodeHex, 16);
    if (opcode === 0x75 || opcode === 0x6d) {
      break;
    }
    if (opcode > 0 && opcode <= 0x4b) {
      const byteLen = opcode;
      const dataHex = body.slice(i + 2, i + 2 + byteLen * 2);
      const val = Buffer.from(dataHex, "hex").toString("utf8");
      fields.push(val);
      i = i + 2 + byteLen * 2;
      continue;
    }
    if (opcode === 0x4c) {
      const lenHex = body.slice(i + 2, i + 4);
      const byteLen = parseInt(lenHex, 16);
      const dataHex = body.slice(i + 4, i + 4 + byteLen * 2);
      const val = Buffer.from(dataHex, "hex").toString("utf8");
      fields.push(val);
      i = i + 4 + byteLen * 2;
      continue;
    }
    if (opcode === 0x4d) {
      const lenHexLE = body.slice(i + 2, i + 6);
      const lenBuf = Buffer.from(lenHexLE, "hex");
      const byteLen = lenBuf.readUInt16LE(0);
      const dataHex = body.slice(i + 6, i + 6 + byteLen * 2);
      const val = Buffer.from(dataHex, "hex").toString("utf8");
      fields.push(val);
      i = i + 6 + byteLen * 2;
      continue;
    }
    break;
  }
  const assetId = fields[0] || "";
  const amountStr = fields[1] || "0";
  const amount = Number(amountStr) as SatoshiValue;
  const metadata = fields[2] || "";
  if (!assetId) return null;
  return { assetId, amount, metadata };
}

function decodeBTMSTokenFromCustomInstructions(ci: any): {
  assetId: string;
  amount: SatoshiValue;
  metadata: string;
} | null {
  if (!ci) return null;
  let obj: any = ci;
  if (typeof ci === "string") {
    try {
      obj = JSON.parse(ci);
    } catch {
      return null;
    }
  }
  if (obj.kind === "btms-mint" && obj.assetId) {
    return {
      assetId: obj.assetId,
      amount: Number(obj.amount ?? 0) as SatoshiValue,
      metadata:
        typeof obj.metadata === "string"
          ? obj.metadata
          : JSON.stringify(obj.metadata || ""),
    };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* mint helper */
/* ------------------------------------------------------------------ */
async function walletMint(
  lockingScript: HexString,
  basket: BasketStringUnder300Bytes,
  satoshis: SatoshiValue,
  description = "BTMS mint",
  extra?: {
    assetId?: string;
    amount?: SatoshiValue;
    metadata?: string;
  },
): Promise<any | null> {
  const wallet: any = walletClient;
  btmsDebug("MINT:walletMint: start", {
    basket,
    satoshis,
    lockingScriptPreview: shortHex(lockingScript, 32),
    isHex: isLikelyHex(lockingScript),
    length: typeof lockingScript === "string" ? lockingScript.length : "n/a",
    extra,
  });
  if (!wallet) {
    btmsDebug("MINT:walletMint: walletClient is undefined/null");
    return null;
  }
  if (typeof lockingScript !== "string") {
    btmsDebug("MINT:walletMint: BAD lockingScript type", {
      typeofLockingScript: typeof lockingScript,
    });
    throw new Error("lockingScript must be a hex string");
  }
  const trimmedLockingScript = lockingScript.trim();
  if (!isLikelyHex(trimmedLockingScript)) {
    btmsDebug(
      "MINT:walletMint: lockingScript fails hex check",
      shortHex(trimmedLockingScript),
    );
  }
  const customInstructions =
    extra && (extra.assetId || extra.amount || extra.metadata)
      ? JSON.stringify({
          kind: "btms-mint",
          assetId: extra.assetId,
          amount: extra.amount,
          metadata: extra.metadata,
        })
      : undefined;
  const tags: OutputTagStringUnder300Bytes[] = ["btms", "mint", "tokens"];
  if (extra?.assetId) {
    tags.push(`asset:${extra.assetId}`);
  }
  const actionReq = {
    description,
    outputs: [
      {
        lockingScript: trimmedLockingScript,
        satoshis,
        basket,
        description,
        outputDescription:
          description && description.length >= 5 ? description : "BTMS mint",
        customInstructions,
        tags,
      } as CreateActionOutput,
    ],
    options: { randomizeOutputs: false },
  };
  btmsDebug("MINT:walletMint: calling wallet.createAction with", {
    ...actionReq,
    outputs: actionReq.outputs.map((o) => ({
      ...o,
      lockingScript: shortHex(o.lockingScript, 32),
    })),
  });
  const startedAt = Date.now();
  const action = await wallet.createAction(actionReq).catch((err: any) => {
    btmsDebug("MINT:walletMint: wallet.createAction FAILED", {
      message: err?.message,
      name: err?.name,
      stack: err?.stack,
    });
    return null;
  });
  btmsDebug(
    "MINT:walletMint: wallet.createAction durationMs",
    Date.now() - startedAt,
  );
  if (!action) {
    btmsDebug(
      "MINT:walletMint: createAction returned null — likely validation failure above",
    );
    return null;
  }
  try {
    const a: any = action as any;
    const atomicBeef = a.tx || a.atomicBeef || a.beef;
    if (atomicBeef) {
      btmsDebug(
        "MINT:walletMint: action has atomic BEEF, broadcasting via HTTPSOverlay + SHIP…",
      );
      const tx = Transaction.fromAtomicBEEF(atomicBeef);
      const facilitator = new HTTPSOverlayBroadcastFacilitator(fetch, true);
      facilitator.allowHTTP = true;
      const broadcaster = new SHIPBroadcaster(["tm_btms"], {
        networkPreset: "local",
        facilitator,
        requireAcknowledgmentFromAnyHostForTopics: "any" as const,
      });
      const result = await broadcaster.broadcast(tx);
      btmsDebug("MINT:walletMint: SHIP broadcast result", result);
    } else {
      btmsDebug(
        "MINT:walletMint: createAction result had no atomic BEEF (tx) — skipping broadcast",
      );
    }
  } catch (e: any) {
    btmsDebug("MINT:walletMint: BTMS/SHIP broadcast failed (continuing)", {
      message: e?.message,
      stack: e?.stack,
    });
  }
  btmsDebug("MINT:walletMint: SUCCESS path done, returning action");
  return action;
}

/* ------------------------------------------------------------------ */
/* wallet helper wrappers */
/* ------------------------------------------------------------------ */
async function walletGetPublicKey(args: any): Promise<string> {
  const res = await (walletClient as any).getPublicKey(args);
  if (typeof res === "string") return res;
  if (res && typeof res.publicKey === "string") return res.publicKey;
  return String(res ?? "");
}

async function walletCreateSignature(args: {
  data: Uint8Array;
  protocolID: WalletProtocol;
  keyID: KeyIDStringUnder800Bytes;
  counterparty: WalletCounterparty;
}): Promise<Uint8Array> {
  const payload = {
    data: Array.from(args.data),
    protocolID: args.protocolID,
    keyID: args.keyID,
    counterparty: args.counterparty,
  };
  btmsDebug("wallet.createSignature payload:", {
    protocolID: payload.protocolID,
    keyID: payload.keyID,
    counterparty: payload.counterparty,
    dataLen: payload.data.length,
  });
  // Call through "any" so we are not constrained by the stricter SDK typings
  const res: any = await (walletClient as any).createSignature(payload as any);
  if (res instanceof Uint8Array) return res;
  if (res && Array.isArray(res.signature))
    return Uint8Array.from(res.signature);
  if (Array.isArray(res)) return Uint8Array.from(res);
  return new Uint8Array();
}

/* ------------------------------------------------------------------ */
/* overlay client */
/* ------------------------------------------------------------------ */
class OverlayClient {
  baseUrl: string;
  apiKey?: string;
  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }
  private buildHeaders(extra?: Record<string, string>) {
    return {
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      ...(extra || {}),
    };
  }
  async get<T = unknown>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    return await fetchJSON<T>(url, {
      method: "GET",
      headers: this.buildHeaders(),
    });
  }
  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    return await fetchJSON<T>(url, {
      method: "POST",
      headers: this.buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
  }
}

export interface LocalToken {
  id: string;
  assetId: string;
  amount: SatoshiValue;
  metadata?: Record<string, unknown> | string;
}

export function createLocalToken(
  assetId: string,
  amount: SatoshiValue,
  metadata?: Record<string, unknown> | string,
): LocalToken {
  return {
    id: makeId("localToken"),
    assetId,
    amount,
    metadata,
  };
}

export interface MarketplaceItem {
  assetId: string;
  amount: SatoshiValue;
  seller: string;
  description?: string;
  desiredAssets?: Record<string, number>;
  metadata?: string;
}

export async function listMarketplaceItems(
  client: OverlayClient,
  query: { findAll?: boolean; seller?: string } = { findAll: true },
): Promise<MarketplaceItem[]> {
  const res = await client.post<{ items: MarketplaceItem[] }>("/lookup", {
    provider: "marketplace",
    query,
  });
  return (res as unknown as MarketplaceItem[]).map((x: any) => x);
}

export async function createMarketplaceItem(
  client: OverlayClient,
  item: MarketplaceItem,
): Promise<{ status: string }> {
  const res = await client.post<{ status: string }>("/submit", {
    ...item,
    provider: "marketplace",
  });
  return res;
}

export interface DecodedLinkage {
  prover: string;
  derivedKey: string;
}

export function decodeLinkageSimple(
  prover: string,
  linkageScalarHex: string,
): DecodedLinkage {
  return {
    prover,
    derivedKey: linkageScalarHex,
  };
}

const minimalEncoding = (buf: any): string => {
  if (!(buf instanceof Buffer)) {
    buf = Buffer.from(buf);
  }
  if (buf.byteLength === 0) {
    return "00";
  }
  if (buf.byteLength === 1 && buf[0] === 0) {
    return "00";
  }
  if (buf.byteLength === 1 && buf[0] > 0 && buf[0] <= 16) {
    return (0x50 + buf[0]).toString(16);
  }
  if (buf.byteLength === 1 && buf[0] === 0x81) {
    return "4f";
  }
  if (buf.byteLength <= 75) {
    return Buffer.concat([Buffer.from([buf.byteLength]), buf]).toString("hex");
  }
  if (buf.byteLength <= 255) {
    return Buffer.concat([
      Buffer.from([0x4c]),
      Buffer.from([buf.byteLength]),
      buf,
    ]).toString("hex");
  }
  if (buf.byteLength <= 65535) {
    const len = Buffer.alloc(2);
    len.writeUInt16LE(buf.byteLength);
    return Buffer.concat([Buffer.from([0x4d]), len, buf]).toString("hex");
  }
  const len = Buffer.alloc(4);
  len.writeUInt32LE(buf.byteLength);
  return Buffer.concat([Buffer.from([0x4e]), len, buf]).toString("hex");
};

const OP_DROP = "75";
const OP_2DROP = "6d";

/* ------------------------------------------------------------------ */
/* token lock / unlock */
/* ------------------------------------------------------------------ */
class BTMSToken {
  async lock(
    protocolID: WalletProtocol,
    keyID: KeyIDStringUnder800Bytes,
    counterparty: WalletCounterparty,
    assetId: string,
    amount: SatoshiValue,
    metadata: string,
    forSelf = false,
  ): Promise<any> {
    let publicKey: PubKeyHex | null = null;
    try {
      publicKey = (await walletGetPublicKey({
        protocolID: protocolID,
        keyID,
        counterparty,
        forSelf,
      })) as PubKeyHex;
    } catch {
      // ignore
    }
    let lockPart: string;
    if (publicKey) {
      lockPart = new LockingScript([
        { op: publicKey.length / 2, data: Utils.toArray(publicKey, "hex") },
        { op: OP.OP_CHECKSIG },
      ]).toHex();
    } else {
      lockPart = "51";
    }
    const fields: Array<string | Uint8Array> = [
      assetId ?? "",
      String(amount ?? 0),
      metadata ?? "",
    ];
    try {
      const dataToSign = Buffer.concat(
        fields.map((x) =>
          typeof x === "string" ? Buffer.from(x) : Buffer.from(x),
        ) as readonly Uint8Array[],
      );
      const signature = await walletCreateSignature({
        data: Uint8Array.from(dataToSign),
        protocolID,
        keyID,
        counterparty,
      });
      if (signature && signature.length) {
        fields.push(signature);
      }
    } catch {
      // ignore
    }
    const pushPart = fields.reduce((acc, el) => acc + minimalEncoding(el), "");
    let dropPart = "";
    let undropped = fields.length;
    while (undropped > 1) {
      dropPart += OP_2DROP;
      undropped -= 2;
    }
    if (undropped) {
      dropPart += OP_DROP;
    }
    return LockingScript.fromHex(`${lockPart}${pushPart}${dropPart}`);
  }
  unlock = (
    protocolID: WalletProtocol,
    keyID: KeyIDStringUnder800Bytes,
    counterparty: WalletCounterparty,
    sourceTXID?: TXIDHexString,
    sourceSatoshis?: SatoshiValue,
    lockingScript?: any,
    signOutputs: "all" | "none" | "single" = "all",
    anyoneCanPay = false,
  ) => {
    return {
      sign: async (tx: any, inputIndex: number): Promise<any> => {
        const input = tx.inputs[inputIndex];
        const otherInputs = tx.inputs.filter(
          (_: any, index: number) => index !== inputIndex,
        );
        sourceTXID = input.sourceTXID
          ? input.sourceTXID
          : (input.sourceTransaction?.id("hex") as string);
        if (!sourceTXID) {
          throw new Error(
            "The input sourceTXID or sourceTransaction is required for transaction signing.",
          );
        }
        sourceSatoshis ||=
          input.sourceTransaction?.outputs[input.sourceOutputIndex].satoshis;
        if (!sourceSatoshis && sourceSatoshis !== 0) {
          throw new Error(
            "The sourceSatoshis or input sourceTransaction is required for transaction signing.",
          );
        }
        lockingScript ||=
          input.sourceTransaction?.outputs[input.sourceOutputIndex]
            .lockingScript;
        if (!lockingScript) {
          throw new Error(
            "The lockingScript or input sourceTransaction is required for transaction signing.",
          );
        }
        let signatureScope = TransactionSignature.SIGHASH_FORKID;
        if (signOutputs === "all") {
          signatureScope |= TransactionSignature.SIGHASH_ALL;
        }
        if (signOutputs === "none") {
          signatureScope |= TransactionSignature.SIGHASH_NONE;
        }
        if (signOutputs === "single") {
          signatureScope |= TransactionSignature.SIGHASH_SINGLE;
        }
        if (anyoneCanPay) {
          signatureScope |= TransactionSignature.SIGHASH_ANYONECANPAY;
        }
        const preimage = TransactionSignature.format({
          sourceTXID,
          sourceOutputIndex: input.sourceOutputIndex,
          sourceSatoshis: sourceSatoshis as number,
          transactionVersion: tx.version,
          otherInputs,
          inputIndex,
          outputs: tx.outputs,
          inputSequence: input.sequence ?? 0xffffffff,
          subscript: lockingScript,
          lockTime: tx.lockTime,
          scope: signatureScope,
        });
        const preimageHash = Hash.sha256(preimage);
        const SDKSignature = await walletCreateSignature({
          data: Uint8Array.from(preimageHash),
          protocolID,
          keyID,
          counterparty,
        });
        const rawSignature = Signature.fromDER([...SDKSignature]);
        const sig = new TransactionSignature(
          rawSignature.r,
          rawSignature.s,
          signatureScope,
        );
        const sigForScript = sig.toChecksigFormat();
        return new UnlockingScript([
          { op: sigForScript.length, data: sigForScript },
        ]);
      },
      estimateLength: async () => 72,
    };
  };
}

/* ------------------------------------------------------------------ */
/* funding token (unchanged logic, types aligned) */
/* ------------------------------------------------------------------ */
class BTMSFundingToken {
  async lock(
    protocolID: WalletProtocol,
    keyID: KeyIDStringUnder800Bytes,
    counterparty: WalletCounterparty,
  ): Promise<any> {
    const fundingPublicKeyString = await walletGetPublicKey({
      protocolID: protocolID,
      keyID,
      counterparty,
    });
    const fundingAddress = PublicKey.fromString(
      fundingPublicKeyString,
    ).toAddress();
    return new P2PKH().lock(fundingAddress);
  }
  unlock = (
    protocolID: WalletProtocol,
    keyID: KeyIDStringUnder800Bytes,
    counterparty: WalletCounterparty,
  ) => {
    return {
      sign: async (tx: any, inputIndex: number): Promise<any> => {
        const input = tx.inputs[inputIndex];
        const otherInputs = tx.inputs.filter(
          (_: any, index: number) => index !== inputIndex,
        );
        const sourceTXID = input.sourceTXID
          ? input.sourceTXID
          : (input.sourceTransaction?.id("hex") as string);
        if (!sourceTXID) {
          throw new Error(
            "The input sourceTXID or sourceTransaction is required for transaction signing.",
          );
        }
        const sourceSatoshis =
          input.sourceTransaction?.outputs[input.sourceOutputIndex].satoshis;
        if (!sourceSatoshis && sourceSatoshis !== 0) {
          throw new Error(
            "The sourceSatoshis or input sourceTransaction is required for transaction signing.",
          );
        }
        const lockingScript =
          input.sourceTransaction?.outputs[input.sourceOutputIndex]
            .lockingScript;
        if (!lockingScript) {
          throw new Error(
            "The lockingScript or input sourceTransaction is required for transaction signing.",
          );
        }
        const signatureScope =
          TransactionSignature.SIGHASH_FORKID |
          TransactionSignature.SIGHASH_ALL;
        const preimage = TransactionSignature.format({
          sourceTXID,
          sourceOutputIndex: input.sourceOutputIndex,
          sourceSatoshis: sourceSatoshis as number,
          transactionVersion: tx.version,
          otherInputs,
          inputIndex,
          outputs: tx.outputs,
          inputSequence: input.sequence ?? 0xffffffff,
          subscript: lockingScript,
          lockTime: tx.lockTime,
          scope: signatureScope,
        });
        const preimageHash = Hash.sha256(preimage);
        const SDKSignature = await walletCreateSignature({
          data: Uint8Array.from(preimageHash),
          protocolID,
          keyID,
          counterparty,
        });
        const rawSignature = Signature.fromDER([...SDKSignature]);
        const sig = new TransactionSignature(
          rawSignature.r,
          rawSignature.s,
          signatureScope,
        );
        const sigForScript = sig.toChecksigFormat();
        const publicKeyString = await walletGetPublicKey({
          protocolID: protocolID,
          keyID,
          counterparty,
          forSelf: true,
        });
        return new UnlockingScript([
          { op: sigForScript.length, data: sigForScript },
          {
            op: publicKeyString.length / 2,
            data: Utils.toArray(publicKeyString, "hex"),
          },
        ]);
      },
      estimateLength: async () => 106,
    };
  };
}

/* ------------------------------------------------------------------ */
/* data shapes */
/* ------------------------------------------------------------------ */
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

/**
 * HMR-safe global cache
 * we stash it on globalThis so every time webpack reloads this file
 * we don’t lose the last snapshot and re-log the same “count: 0”.
 */
const GLOBAL_CACHE_KEY = "__btmsGlobalCacheNW__";
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
// Let TS know about our global cache slot
declare global {
  // Works in both browser and Node typings via globalThis
  // eslint-disable-next-line no-var
  var __btmsGlobalCacheNW__: BTMSGlobalCache | undefined;
}
const globalCache: BTMSGlobalCache = (() => {
  if (typeof globalThis !== "undefined") {
    if (!globalThis.__btmsGlobalCacheNW__) {
      globalThis.__btmsGlobalCacheNW__ = {
        lastAssetSnapshot: [],
        lastAssetFetchMs: 0,
        hasFetchedOnce: false,
      } as BTMSGlobalCache;
    }
    return globalThis.__btmsGlobalCacheNW__ as BTMSGlobalCache;
  }
  return {
    lastAssetSnapshot: [],
    lastAssetFetchMs: 0,
    hasFetchedOnce: false,
  };
})();
// fallback values if globalThis isn’t available
let __btmsLastAssetSnapshot: Asset[] = globalCache.lastAssetSnapshot;
let __btmsLastAssetFetchMs = globalCache.lastAssetFetchMs;
const ASSET_REFRESH_MS = 30_000; // 30 seconds

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

interface BuyerOfferCustomInstructions {
  buyerProof: OwnershipProof;
  buyerOfferedAssetId: string;
  buyerOfferedamount: SatoshiValue;
  sellerEntry: MarketplaceEntry;
  fundingkeyID: KeyIDStringUnder800Bytes;
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

function verifyTruthy<T>(v: T | null | undefined, description?: string): T {
  if (v == null) throw new Error(description ?? "A truthy value is required.");
  return v;
}

/* ------------------------------------------------------------------ */
/* message-box-client transport (now uses stub) */
/* ------------------------------------------------------------------ */
const DEFAULT_MESSAGEBOX_HOST = "https://messagebox.babbage.systems";

class MessageBoxTokenator {
  private wallet: any;
  private defaultBox: string;
  private host: string;
  private client: MessageBoxClient | null = null;
  private initPromise: Promise<MessageBoxClient> | null = null;
  constructor(wallet: any, defaultBox: string, host = DEFAULT_MESSAGEBOX_HOST) {
    this.wallet = wallet;
    this.defaultBox = defaultBox;
    this.host = host;
  }
  private async ensureClient(): Promise<MessageBoxClient> {
    if (this.client) return this.client;
    if (!this.initPromise) {
      if (BTMS_DEBUG) {
        btmsDebug("MessageBoxTokenator: creating MessageBoxClient…", {
          host: this.host,
          box: this.defaultBox,
        });
      }
      // tolerate older/newer wallet-client versions
      const net = await (walletClient as any).getNetwork?.();
      const networkPreset = net?.network || "mainnet";
      this.initPromise = (async () => {
        const client = new MessageBoxClient({
          host: this.host,
          networkPreset,
          walletClient: this.wallet,
          enableLogging: true,
        });
        await client.init();
        if (BTMS_DEBUG) {
          btmsDebug("MessageBoxTokenator: client.init() done");
        }
        this.client = client;
        return client;
      })();
    }
    return this.initPromise;
  }
  async sendMessage(args: {
    recipient: string;
    messageBox?: string;
    body: any;
  }): Promise<void> {
    const client = await this.ensureClient();
    const { recipient, messageBox, body } = args;
    const box = messageBox || this.defaultBox;
    // Always send a string to Message Box
    const payload = typeof body === "string" ? body : JSON.stringify(body);
    // Helper to safely parse JSON strings for logging only
    const safeParse = (s: string) => {
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    };
    // Compute beef length without touching the string 'payload'
    const bodyObj: any = typeof body === "string" ? safeParse(body) : body;
    const beefArr: any =
      (bodyObj && Array.isArray(bodyObj?.beef) && bodyObj.beef) ||
      (bodyObj && Array.isArray(bodyObj?.token?.beef) && bodyObj.token.beef) ||
      null;
    const beefLen = Array.isArray(beefArr) ? beefArr.length : null;
    if (BTMS_DEBUG) {
      btmsDebug("MessageBoxTokenator.sendMessage ->", {
        recipient,
        box,
        bodyPreview:
          typeof payload === "string"
            ? payload.slice(0, 160)
            : String(typeof payload),
        beefLen,
      });
    }
    const t0 = Date.now();
    try {
      const resp: any = await client.sendMessage({
        recipient,
        messageBox: box,
        body: payload,
      });
      btmsDebug("[Tokenator] sendMessage OK", {
        ms: Date.now() - t0,
        hasResp: resp != null,
        keys: resp ? Object.keys(resp) : [],
        status: resp?.status ?? "unknown",
        id: resp?.id ?? resp?.messageId ?? resp?._id ?? null,
        beefLen,
      });
    } catch (e: any) {
      btmsDebug("[Tokenator] sendMessage ERROR", {
        ms: Date.now() - t0,
        message: e?.message,
        stackTop: String(e?.stack || "")
          .split("\n")
          .slice(0, 3)
          .join(" | "),
      });
      throw e;
    }
  }
  async listMessages(args: { messageBox?: string }) {
    const client = await this.ensureClient();
    const box = args.messageBox || this.defaultBox;
    const msgs = await client.listMessages({ messageBox: box });
    return msgs;
  }
  async acknowledgeMessage(args: { messageIds: string[] }): Promise<void> {
    return this.acknowledgeMessages(args);
  }
  async acknowledgeMessages(args: { messageIds: string[] }): Promise<void> {
    const client = await this.ensureClient();
    if (!args.messageIds || !args.messageIds.length) return;
    await client.acknowledgeMessage({ messageIds: args.messageIds });
  }
}

/* ------------------------------------------------------------------ */
/* main BTMS class */
/* ------------------------------------------------------------------ */
export class BTMS {
  tokenator: MessageBoxTokenator;
  tokensMessageBox: string;
  marketplaceMessageBox: string;
  protocolID: WalletProtocol;
  basket: BasketStringUnder300Bytes;
  tokenTopic: string;
  satoshis: SatoshiValue;
  privateKey: string | undefined;
  marketplaceTopic: string;
  private requester: (url: string, init?: RequestInit) => Promise<Response>;
  private instanceId: string;
  constructor(
    tokensMessageBox = "tokens-box",
    protocolID: WalletProtocol = [0, "tokens"],
    basket = "tokens" as BasketStringUnder300Bytes,
    tokensTopic = "tokens",
    satoshis: SatoshiValue = 1,
    privateKey?: string,
    marketplaceMessageBox = "marketplace",
    marketplaceTopic = "marketplace",
  ) {
    this.tokensMessageBox = tokensMessageBox;
    this.protocolID = protocolID;
    this.basket = basket;
    this.tokenTopic = tokensTopic;
    this.satoshis = satoshis;
    this.tokenator = new MessageBoxTokenator(walletClient, tokensMessageBox);
    this.privateKey = privateKey;
    this.marketplaceMessageBox = marketplaceMessageBox;
    this.marketplaceTopic = marketplaceTopic;
    this.requester = activeAuthFetch
      ? (url, init) => activeAuthFetch!(url, init)
      : (url, init) => fetch(url, init);
    this.instanceId = makeId("btmsInstance");
    btmsDebug("constructor called", {
      protocolID: this.protocolID,
      instanceId: this.instanceId,
      source: BTMS_SOURCE_TAG,
      stack: new Error("BTMS constructor stack").stack,
    });
  }
  async getPublicKey(args: {
    identityKey?: boolean;
    protocolID?: WalletProtocol;
    keyID?: KeyIDStringUnder800Bytes;
    counterparty?: WalletCounterparty;
    forSelf?: boolean;
  }): Promise<string> {
    const normalized = {
      ...args,
      protocolID: args.protocolID ? args.protocolID : undefined,
    };
    return walletGetPublicKey(normalized);
  }
  async listAssets(): Promise<Asset[]> {
    const callId = makeDebugCallId("listAssets");
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
      if (
        globalCache.hasFetchedOnce &&
        globalCache.lastAssetSnapshot.length === 0
      ) {
        btmsDebug(
          `${callId}: serving EMPTY snapshot from GLOBAL cache (suppressing re-fetch)`,
          {
            ageMs: age,
            count: 0,
            instanceId: this.instanceId,
          },
        );
        return [];
      }
      // normal 30s cache
      if (age < ASSET_REFRESH_MS) {
        btmsDebug(`${callId}: serving from GLOBAL cache (even if empty)`, {
          ageMs: age,
          count: globalCache.lastAssetSnapshot.length,
          instanceId: this.instanceId,
        });
        return globalCache.lastAssetSnapshot.map((a) => ({ ...a }));
      } else {
        btmsDebug(`${callId}: cache miss or stale`, {
          ageMs: age,
          hadSnapshot: globalCache.lastAssetSnapshot.length > 0,
          refreshMs: ASSET_REFRESH_MS,
          hasFetchedOnce: globalCache.hasFetchedOnce,
        });
      }
      const wallet: any = walletClient;
      const assets = new Map<string, Asset>();
      let bsvTotal: SatoshiValue = 0 as SatoshiValue;
      let outs: WalletOutput[] = [];
      let beefMap: Record<string, number[] | Uint8Array> | null = null;
      if (typeof wallet.listOutputs === "function") {
        const args = {
          basket: this.basket,
          limit: 200,
          offset: 0,
          include: "entire transactions",
          includeCustomInstructions: true,
          seekPermission: false,
        } as ListOutputsArgs;
        btmsDebug(`${callId}: calling wallet.listOutputs(...)`, {
          args,
          instanceId: this.instanceId,
        });
        try {
          const res = (await wallet.listOutputs(args)) as ListOutputsResult & {
            BEEF?: Record<string, number[] | Uint8Array>;
            beef?: Record<string, number[] | Uint8Array>;
          };
          outs = Array.isArray(res.outputs) ? res.outputs : [];
          beefMap = (res.BEEF || res.beef || null) as Record<
            string,
            number[] | Uint8Array
          > | null;
          btmsDebug(`${callId}: wallet.listOutputs OK`, {
            returnedKeys: res ? Object.keys(res as any) : [],
            count: outs.length,
            hasBEEF: !!beefMap,
            beefKeys: beefMap ? Object.keys(beefMap) : [],
          });
        } catch (err: any) {
          btmsDebug(`${callId}: wallet.listOutputs FAILED`, {
            message: err?.message,
            name: err?.name,
            stack: err?.stack,
            looksLikePermission:
              typeof err?.message === "string" && /perm/i.test(err.message),
          });
          // since we *attempted*, don’t let the UI keep hammering
          globalCache.hasFetchedOnce = true;
        }
      } else {
        btmsDebug(`${callId}: wallet has NO listOutputs`, {
          walletKeys: Object.keys(wallet || {}),
        });
        // also mark tried
        globalCache.hasFetchedOnce = true;
      }
      btmsDebug(`${callId}: wallet returned outputs:`, {
        count: outs.length,
        basket: this.basket,
        instanceId: this.instanceId,
      });
      let idx = 0;
      for (const o of outs) {
        idx += 1;
        // support both new-world beefPayload (if present on the output)
        const beefPayload = (o as any).beefPayload || null;
        let scriptHex = extractLockingScriptFromWalletOutput(o);
        const outpoint = (o as any).outpoint as string | undefined;
        let voutIndex =
          Number.isFinite((o as any).vout) && (o as any).vout >= 0
            ? (o as any).vout
            : 0;
        let txidFromOutpoint: string | undefined;
        // more robust outpoint parsing: txid.vout OR txid:vout
        if (typeof outpoint === "string") {
          const m = outpoint.match(/^([0-9a-fA-F]+)[\.\:](\d+)$/);
          if (m) {
            txidFromOutpoint = m[1];
            const maybeVout = parseInt(m[2], 10);
            if (Number.isFinite(maybeVout)) {
              voutIndex = maybeVout;
            }
          }
        }
        const lockingScriptLen = scriptHex ? scriptHex.length : 0;
        const hasBeefPayload = !!beefPayload;
        const hasBeefMap = !!beefMap;
        if (!scriptHex && BTMS_DEBUG) {
          btmsDebug(
            `${callId}: output #${idx} has no script in wallet output; will consider BEEF/customInstructions`,
            {
              instanceId: this.instanceId,
              outpoint,
              voutIndex,
              hasBeefMap,
              hasBeefPayload,
              satoshis: (o as any).satoshis,
            },
          );
        }
        btmsDebug(`${callId}: output #${idx}`, {
          satoshis: (o as any).satoshis,
          voutIndex,
          lockingScriptPreview: shortHex(scriptHex, 48),
          lockingScriptLen,
          hasBeefPayload,
          instanceId: this.instanceId,
        });
        // -------------------------------------------------------------------
        // 1) No visible script AND no beefPayload but we DO have a BEEF map:
        // reconstruct the script from wallet.BEEF using the outpoint txid.
        // -------------------------------------------------------------------
        if (
          !scriptHex &&
          hasBeefMap &&
          !hasBeefPayload &&
          txidFromOutpoint &&
          beefMap &&
          beefMap[txidFromOutpoint]
        ) {
          try {
            const rawBeefLike = beefMap[txidFromOutpoint];
            const asUint8 =
              rawBeefLike instanceof Uint8Array
                ? rawBeefLike
                : Uint8Array.from(rawBeefLike as number[]);
            let txFromBeef: any;
            try {
              txFromBeef = Transaction.fromAtomicBEEF(Array.from(asUint8));
              btmsDebug(
                `${callId}: parsed atomicBEEF from wallet.BEEF for output #${idx}`,
                { txid: txidFromOutpoint, voutIndex },
              );
            } catch (atomicErr: any) {
              btmsDebug(
                `${callId}: atomicBEEF parse failed from wallet.BEEF, trying full BEEF for output #${idx}`,
                { message: atomicErr?.message, txid: txidFromOutpoint },
              );
              txFromBeef = Transaction.fromBEEF(Array.from(asUint8));
            }
            const out = txFromBeef.outputs[voutIndex];
            if (out && out.lockingScript) {
              const ls: any = out.lockingScript;
              if (ls && typeof ls.toHex === "function") {
                scriptHex = ls.toHex();
              } else if (ls instanceof Uint8Array) {
                scriptHex = Array.from(ls as Uint8Array)
                  .map((b) => b.toString(16).padStart(2, "0"))
                  .join("");
              } else if (Array.isArray(ls)) {
                scriptHex = (ls as any[])
                  .map((n) => Number(n).toString(16).padStart(2, "0"))
                  .join("");
              }
              btmsDebug(
                `${callId}: reconstructed script from wallet.BEEF for output #${idx}`,
                {
                  txid: txidFromOutpoint,
                  voutIndex,
                  scriptPreview: scriptHex
                    ? shortHex(scriptHex, 48)
                    : "(no scriptHex)",
                  scriptLen: scriptHex ? scriptHex.length : 0,
                },
              );
            } else {
              btmsDebug(
                `${callId}: wallet.BEEF had tx but no output at voutIndex for output #${idx}`,
                {
                  txid: txidFromOutpoint,
                  voutIndex,
                  outputsLen: txFromBeef.outputs.length,
                },
              );
            }
          } catch (e: any) {
            btmsDebug(
              `${callId}: failed to reconstruct script from wallet.BEEF for output #${idx}`,
              {
                txid: txidFromOutpoint,
                message: e?.message,
                stackTop: String(e?.stack || "").split("\n")[0],
              },
            );
          }
        }
        // -------------------------------------------------------------------
        // 2) Still no script? Try customInstructions / beefPayload.
        // -------------------------------------------------------------------
        if (!scriptHex) {
          const ci =
            (o as any).customInstructions ||
            (beefPayload as any)?.outputs?.[voutIndex]?.customInstructions ||
            (beefPayload as any)?.outputs?.[0]?.customInstructions;
          const decodedFromCI = decodeBTMSTokenFromCustomInstructions(ci);
          if (decodedFromCI) {
            const existing = assets.get(decodedFromCI.assetId);
            let friendlyName: string | undefined;
            if (decodedFromCI.metadata) {
              try {
                const parsed = JSON.parse(decodedFromCI.metadata);
                friendlyName =
                  parsed.name ||
                  parsed.tokenName ||
                  parsed.title ||
                  decodedFromCI.assetId;
              } catch {
                friendlyName = decodedFromCI.metadata;
              }
            }
            if (existing) {
              existing.balance =
                (existing.balance as number) +
                (decodedFromCI.amount as number as SatoshiValue);
            } else {
              assets.set(decodedFromCI.assetId, {
                assetId: decodedFromCI.assetId,
                balance: decodedFromCI.amount,
                name: friendlyName || decodedFromCI.assetId,
                metadata: decodedFromCI.metadata,
              });
            }
            btmsDebug(
              `${callId}: output #${idx} decoded as BTMS token via customInstructions`,
              {
                assetId: decodedFromCI.assetId,
                amount: decodedFromCI.amount,
                voutIndex,
                instanceId: this.instanceId,
              },
            );
            continue;
          }
          const sat = Number(
            (o as any).satoshis ?? (o as any).amount ?? 0,
          ) as SatoshiValue;
          bsvTotal = ((bsvTotal as number) + (sat as number)) as SatoshiValue;
          btmsDebug(
            `${callId}: output #${idx} had NO script ANYWHERE (even after BEEF/customInstructions), counted as BSV`,
            {
              addedSatoshis: sat,
              runningBSV: bsvTotal,
              raw: o,
              instanceId: this.instanceId,
            },
          );
          continue;
        }
        // -------------------------------------------------------------------
        // 3) Script present (either directly or via BEEF): try pure BTMS decode;
        // if that fails, count as BSV.
        // -------------------------------------------------------------------
        const decoded = decodeBTMSTokenFromScript(scriptHex);
        if (decoded) {
          const existing = assets.get(decoded.assetId);
          let friendlyName: string | undefined;
          if (decoded.metadata) {
            try {
              const parsed = JSON.parse(decoded.metadata);
              friendlyName =
                parsed.name ||
                parsed.tokenName ||
                parsed.title ||
                decoded.assetId;
            } catch {
              friendlyName = decoded.metadata;
            }
          }
          if (existing) {
            existing.balance =
              (existing.balance as number) +
              (decoded.amount as number as SatoshiValue);
          } else {
            assets.set(decoded.assetId, {
              assetId: decoded.assetId,
              balance: decoded.amount,
              name: friendlyName || decoded.assetId,
              metadata: decoded.metadata,
            });
          }
          btmsDebug(
            `${callId}: output #${idx} decoded as BTMS token via script`,
            {
              assetId: decoded.assetId,
              amount: decoded.amount,
              voutIndex,
              instanceId: this.instanceId,
            },
          );
        } else {
          const sat = Number(
            (o as any).satoshis ?? (o as any).amount ?? 0,
          ) as SatoshiValue;
          bsvTotal = ((bsvTotal as number) + (sat as number)) as SatoshiValue;
          btmsDebug(
            `${callId}: output #${idx} script did NOT look like BTMS, counted as BSV`,
            {
              addedSatoshis: sat,
              runningBSV: bsvTotal,
              instanceId: this.instanceId,
            },
          );
        }
      }
      const result: Asset[] = Array.from(assets.values());
      if ((bsvTotal as number) > 0) {
        result.unshift({ assetId: "BSV", balance: bsvTotal });
      }
      btmsDebug(`${callId}: FINAL ASSET LIST ->`, result, {
        instanceId: this.instanceId,
      });
      // update global cache (even if empty — and mark that we have fetched once)
      globalCache.lastAssetSnapshot = result.map((a) => ({ ...a }));
      globalCache.lastAssetFetchMs = now;
      globalCache.hasFetchedOnce = true;
      return result;
    } catch (err) {
      btmsDebug("listAssets failed, returning cached or empty.", err, {
        instanceId: this.instanceId,
      });
      // if we failed, remember that we *did* try — so we don’t spam again
      globalCache.hasFetchedOnce = true;
      if (globalCache.lastAssetSnapshot.length) {
        return globalCache.lastAssetSnapshot.map((a) => ({ ...a }));
      }
      return [];
    }
  }
  async listIncomingPayments(assetId?: string): Promise<IncomingPayment[]> {
    // the client is JS-y; tell TS what shape we expect
    const msgs = (await this.tokenator.listMessages({
      messageBox: this.tokensMessageBox,
    })) as Array<{
      body: string | Record<string, any>;
      sender: string;
      messageId: string;
    }>;
    const results: IncomingPayment[] = [];
    for (const msg of msgs) {
      try {
        // msg.body can be string or object
        const rawBody = msg.body;
        // sometimes it's a stringified string (double-encoded), sometimes one level
        let payload: any;
        if (typeof rawBody === "string") {
          const once = JSON.parse(rawBody);
          payload = typeof once === "string" ? JSON.parse(once) : once;
        } else {
          payload = rawBody;
        }
        const amt = Number(
          payload.amount ?? payload.token?.amount ?? 0,
        ) as SatoshiValue;
        const msgAssetId = payload.assetId ?? payload.token?.assetId;
        if (assetId && msgAssetId && msgAssetId !== assetId) {
          continue;
        }
        const payment: IncomingPayment = {
          txid: payload.txid ?? "",
          vout: payload.vout ?? 0,
          amount: amt,
          token: (payload.token ?? {
            txid: payload.txid ?? "",
            vout: payload.vout ?? 0,
            amount: amt,
            beefPayload: (payload.beefPayload ?? {}) as CreateActionResult,
            keyID: payload.keyID ?? "default",
            lockingScript: "",
          }) as TokenForRecipient,
          sender: msg.sender,
          messageId: msg.messageId,
          keyID: payload.keyID ?? "default",
          beefPayload: (payload.beefPayload ?? {}) as CreateActionResult,
          lockingScript: "",
        };
        results.push(payment);
      } catch (err) {
        btmsDebug("failed to parse incoming payment message", err, msg);
      }
    }
    return results;
  }
  async acceptIncomingPayment(
    assetId: string,
    payment: IncomingPayment,
  ): Promise<void> {
    const callId = makeDebugCallId("acceptIncomingPayment");
    btmsDebug(`${callId}: start`, { assetId, payment });
    // ---- 1) Gather script + BEEF context ----
    // NEW: only support new-world lockingScript on the payment.
    let scriptHex: string | undefined;
    const scriptField: any = (payment as any).lockingScript;
    if (typeof scriptField === "string") {
      scriptHex = scriptField;
    } else if (Array.isArray(scriptField)) {
      // assume number[] bytes
      const bytes = scriptField.map((n: any) => Number(n) & 0xff);
      scriptHex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    const beefPayload: any =
      (payment as any).beefPayload ||
      (payment.token as any)?.beefPayload ||
      null;
    btmsDebug(`${callId}: incoming payment raw fields`, {
      hasLockingScript: !!(payment as any).lockingScript,
      hasBeefPayload: !!beefPayload,
      beefKeys: beefPayload ? Object.keys(beefPayload) : [],
      vout: payment.vout,
    });
    // Try to reconstruct script from atomicBeef / BEEF if we don't have one yet
    let overlayTxid = payment.txid || "";
    if (!scriptHex && beefPayload) {
      try {
        // be tolerant of both atomic BEEF and BEEF, and of different field names
        const rawBeefLike: any =
          beefPayload.atomicBeef ??
          beefPayload.atomicBEEF ??
          beefPayload.beef ??
          beefPayload.tx ??
          beefPayload.context;
        if (rawBeefLike) {
          let rawBeef: Uint8Array;
          if (Array.isArray(rawBeefLike)) {
            rawBeef = new Uint8Array(
              rawBeefLike.map((n: any) => Number(n) & 0xff),
            );
          } else if (rawBeefLike instanceof Uint8Array) {
            rawBeef = rawBeefLike;
          } else {
            // last-ditch: assume it’s an object with a numeric .data property, etc.
            const maybeArray = (rawBeefLike as any).data;
            if (Array.isArray(maybeArray)) {
              rawBeef = new Uint8Array(
                maybeArray.map((n: any) => Number(n) & 0xff),
              );
            } else {
              throw new Error("Unsupported rawBeef shape on beefPayload");
            }
          }
          let tx: any;
          try {
            // prefer atomic BEEF; fall back to full BEEF
            tx = Transaction.fromAtomicBEEF(Array.from(rawBeef));
          } catch {
            tx = Transaction.fromBEEF(Array.from(rawBeef));
          }
          const voutIndex = Number.isFinite(payment.vout) ? payment.vout! : 0;
          const out = tx.outputs[voutIndex];
          if (!out) {
            btmsDebug(
              `${callId}: could not find output at vout for reconstructed tx`,
              { voutIndex, outputs: tx.outputs.length },
            );
          } else {
            // always use lockingScript (new-world)
            const ls: any = out.lockingScript;
            if (ls && typeof ls.toHex === "function") {
              scriptHex = ls.toHex();
            } else if (ls instanceof Uint8Array) {
              scriptHex = Array.from(ls as Uint8Array)
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
            } else if (Array.isArray(ls)) {
              scriptHex = (ls as any[])
                .map((n) => Number(n).toString(16).padStart(2, "0"))
                .join("");
            }
            const computedTxid = tx.id("hex");
            if (!overlayTxid && computedTxid) {
              overlayTxid = computedTxid;
            }
            btmsDebug(`${callId}: reconstructed script from beefPayload`, {
              computedTxid,
              voutIndex,
              scriptPreview: scriptHex
                ? shortHex(scriptHex, 48)
                : "(no scriptHex)",
              scriptLen: scriptHex ? scriptHex.length : 0,
            });
          }
        } else {
          btmsDebug(
            `${callId}: beefPayload present but no atomicBeef/beef/tx/context field`,
          );
        }
      } catch (e: any) {
        btmsDebug(`${callId}: failed to reconstruct script from beefPayload`, {
          message: e?.message,
          stackTop: String(e?.stack || "").split("\n")[0],
        });
      }
    }
    // If we still don't have a script, we can't continue
    if (!scriptHex) {
      btmsDebug(
        `${callId}: no script available on incoming payment (no lockingScript and script reconstruction from beefPayload failed) — acking & failing`,
        { payment },
      );
      if (payment?.messageId) {
        await this.tokenator.acknowledgeMessage({
          messageIds: [payment.messageId],
        });
      }
      throw new Error(
        "Incoming payment is missing a spendable lockingScript and script reconstruction from beefPayload failed",
      );
    }
    // ---- 2) Decode script to get assetId, amount, metadata, lockingPublicKey ----
    const parsed = parseBTMSScriptFull(scriptHex);
    const parsedAssetId = parsed.assetId;
    const parsedAmount = parsed.amount;
    // Use the best-known txid for ISSUE aliasing
    const aliasTxid = overlayTxid || payment.txid || "";
    // Handle ISSUE -> txid.vout aliasing
    const actualAssetId =
      parsedAssetId && parsedAssetId !== "ISSUE"
        ? parsedAssetId
        : (`${aliasTxid}.${payment.vout ?? 0}` as string);
    btmsDebug(`${callId}: parsed script`, {
      parsed,
      actualAssetId,
      requestedAssetId: assetId,
      aliasTxid,
    });
    // ---- 3) Asset ID must match ----
    if (assetId && actualAssetId && assetId !== actualAssetId) {
      btmsDebug(
        `${callId}: token assetId mismatch (wanted ${assetId}, got ${actualAssetId}) — acking and failing`,
      );
      if (payment?.messageId) {
        await this.tokenator.acknowledgeMessage({
          messageIds: [payment.messageId],
        });
      }
      throw new Error(
        `This token is for assetId ${actualAssetId}, but you tried to accept ${assetId}`,
      );
    }
    // ---- 4) Verify token was locked to *our* derived key
    // TEMPORARILY RELAXED: we only log mismatches, we do NOT throw.
    let myKeyHex: string | undefined;
    if (parsed.lockingPublicKey) {
      try {
        const myKey = await this.getPublicKey({
          protocolID: this.protocolID,
          keyID: payment.keyID || "default",
          counterparty: payment.sender,
          forSelf: true,
        });
        myKeyHex = myKey?.toLowerCase();
        btmsDebug(`${callId}: got my locking key`, { myKeyHex });
      } catch (e: any) {
        btmsDebug(
          `${callId}: could not fetch my locking key (continuing anyway)`,
          {
            message: e?.message,
          },
        );
      }
      if (myKeyHex) {
        const normalizedLock = parsed.lockingPublicKey.toLowerCase();
        if (myKeyHex !== normalizedLock) {
          btmsDebug(
            `${callId}: locking key mismatch — TEMPORARILY ALLOWING token anyway`,
            {
              mine: myKeyHex,
              theirs: normalizedLock,
            },
          );
          // NOTE: no ack/throw here; we just continue for now.
        }
      }
    }
    // ---- 5) Ensure token is on overlay (old-world strict behaviour) ----
    const vout = payment.vout ?? 0;
    btmsDebug(`${callId}: checking overlay presence`, {
      txid: aliasTxid,
      vout,
    });
    const alreadyThere = await this.findFromTokenOverlay({
      txid: aliasTxid as TXIDHexString,
      vout,
    });
    if (!alreadyThere.length) {
      btmsDebug(`${callId}: token not on overlay — attempting to submit`);
      const submitBeefPayload: any = beefPayload;
      if (
        !submitBeefPayload ||
        !Array.isArray(submitBeefPayload.atomicBeef) ||
        !submitBeefPayload.atomicBeef.length
      ) {
        btmsDebug(
          `${callId}: missing or invalid beefPayload.atomicBeef on incoming payment — acking & failing`,
          { payment },
        );
        if (payment?.messageId) {
          await this.tokenator.acknowledgeMessage({
            messageIds: [payment.messageId],
          });
        }
        throw new Error(
          "Incoming payment is missing required beefPayload.atomicBeef",
        );
      }
      try {
        await this.submitToTokenOverlay({
          atomicBeef: submitBeefPayload.atomicBeef,
        });
      } catch (err: any) {
        btmsDebug(`${callId}: submitToTokenOverlay failed`, {
          message: err?.message,
        });
        // fall through to strict re-check below
      }
      const verifiedAfterSubmit = await this.findFromTokenOverlay({
        txid: aliasTxid as TXIDHexString,
        vout,
      });
      if (!verifiedAfterSubmit.length) {
        btmsDebug(
          `${callId}: token is for me but still not on overlay after submit — acking & failing`,
        );
        if (payment?.messageId) {
          await this.tokenator.acknowledgeMessage({
            messageIds: [payment.messageId],
          });
        }
        throw new Error("Token is for me but not on the overlay");
      }
    } else {
      btmsDebug(`${callId}: token already present on overlay`);
    }
    // ---- 6) Build UX metadata (note/labels) from parsed metadata ----
    let tokenName = "Token";
    let labels: string[] = [];
    const amountStr = parsedAmount != null ? String(parsedAmount) : "";
    try {
      if (parsed.metadata) {
        const meta =
          typeof parsed.metadata === "string"
            ? JSON.parse(parsed.metadata)
            : parsed.metadata;
        if (meta && typeof meta.name === "string") {
          tokenName = meta.name;
        } else if (meta && typeof meta.description === "string") {
          tokenName = meta.description;
        }
      }
    } catch {
      // ignore metadata parse errors
    }
    if (actualAssetId) {
      labels = [actualAssetId.replace(".", " ")];
    }
    const note = `Receive ${amountStr} ${tokenName} from ${payment.sender}`;
    btmsDebug(`${callId}: built wallet note/labels`, { note, labels });
    // ---- 7) Tell the wallet “this is mine now” via internalizeAction ----
    try {
      const wallet = walletClient;
      // 7a) Inspect raw atomicBeef from BTMS payload
      const rawAtomic: any =
        beefPayload && (beefPayload as any).atomicBeef !== undefined
          ? (beefPayload as any).atomicBeef
          : null;
      btmsDebug(`${callId}: raw beefPayload.atomicBeef snapshot`, {
        hasBeefPayload: !!beefPayload,
        type: rawAtomic === null ? "null" : typeof rawAtomic,
        isArray: Array.isArray(rawAtomic),
        tag:
          rawAtomic && rawAtomic.constructor
            ? rawAtomic.constructor.name
            : null,
        sample:
          Array.isArray(rawAtomic) || rawAtomic instanceof Uint8Array
            ? Array.from(rawAtomic).slice(0, 16)
            : rawAtomic,
      });
      // 7b) Normalize & canonicalize via Transaction.fromAtomicBEEF / fromBEEF / toAtomicBEEF
      let atomicBeef: number[] = [];
      if (Array.isArray(rawAtomic) || rawAtomic instanceof Uint8Array) {
        try {
          const asUint8 =
            rawAtomic instanceof Uint8Array
              ? rawAtomic
              : Uint8Array.from(rawAtomic as number[]);
          let txFromBeef: any;
          try {
            txFromBeef = Transaction.fromAtomicBEEF(Array.from(asUint8));
            btmsDebug(`${callId}: parsed atomicBEEF for wallet internalize`, {
              txid: aliasTxid,
            });
          } catch (atomicErr: any) {
            btmsDebug(
              `${callId}: atomicBEEF parse failed for wallet internalize, trying full BEEF`,
              { message: atomicErr?.message },
            );
            txFromBeef = Transaction.fromBEEF(Array.from(asUint8));
          }
          const atomicBytes = txFromBeef.toAtomicBEEF();
          atomicBeef = Array.from(atomicBytes, (n: number) => Number(n) & 0xff);
          btmsDebug(`${callId}: built AtomicBEEF for wallet internalize`, {
            txid: aliasTxid,
            beefLen: Array.isArray(beefPayload?.atomicBeef)
              ? beefPayload.atomicBeef.length
              : 0,
            atomicLen: atomicBeef.length,
            firstBytes: atomicBeef.slice(0, 16),
          });
        } catch (e: any) {
          btmsDebug(
            `${callId}: FAILED to canonicalize beefPayload.atomicBeef for wallet internalize`,
            { message: e?.message },
          );
        }
      } else if (rawAtomic != null) {
        btmsDebug(
          `${callId}: unexpected atomicBeef shape (not array/Uint8Array)`,
          { value: rawAtomic },
        );
      }
      if (!atomicBeef.length) {
        btmsDebug(
          `${callId}: wallet internalize skipped — missing/invalid beefPayload.atomicBeef`,
          { payment },
        );
        // we still continue to ack at the end
        return;
      }
      // 7c) Call wallet.internalizeAction as a basket insertion
      const walletLabels =
        labels && labels.length ? labels : [actualAssetId || "btms-token"];
      // For BTMS this is effectively always the token's vout
      const outputIndex = typeof vout === "number" && vout >= 0 ? vout : 0;
      const insertionRemittance = {
        basket: this.basket,
        tags: walletLabels,
      };
      const internalizeArgs: InternalizeActionArgs = {
        tx: atomicBeef,
        outputs: [
          {
            outputIndex,
            protocol: "basket insertion",
            insertionRemittance,
          } as any,
        ],
        description: note,
        labels: walletLabels,
        seekPermission: false,
      } as unknown as InternalizeActionArgs;
      btmsDebug(`${callId}: calling wallet.internalizeAction(...)`, {
        basket: this.basket,
        vout: outputIndex,
        txLength: atomicBeef.length,
        insertionRemittance,
      });
      const internalizeResult: any = await (wallet as any).internalizeAction(
        internalizeArgs as any,
      );
      btmsDebug(`${callId}: wallet.internalizeAction completed`, {
        accepted: internalizeResult?.accepted === true,
      });
      // If it really was accepted, force the next listAssets() call
      // to hit the wallet again (instead of re-serving an empty cache).
      if (internalizeResult?.accepted) {
        globalCache.hasFetchedOnce = false;
        globalCache.lastAssetFetchMs = 0;
        globalCache.lastAssetSnapshot = [];
      } else {
        btmsDebug(
          `${callId}: wallet.internalizeAction did NOT report accepted:true`,
        );
      }
    } catch (err: any) {
      btmsDebug(`${callId}: wallet internalize failed (continuing)`, {
        message: err?.message,
        stack: err?.stack,
      });
    }
    // ---- 8) Finally, ack the message so it disappears from inbox ----
    if (payment?.messageId) {
      await this.tokenator.acknowledgeMessage({
        messageIds: [payment.messageId],
      });
    }
    btmsDebug(`${callId}: done`);
  }
  async refundIncomingTransaction(
    _assetId: string,
    payment: IncomingPayment,
  ): Promise<void> {
    if (payment?.messageId) {
      await this.tokenator.acknowledgeMessage({
        messageIds: [payment.messageId],
      });
    }
  }
  /**
   * Send a BTMS-style payment/message to another identity via message-box-client.
   * Hydration order: LookupResolver (Meter default) -> HTTP LARS (localhost:8080).
   * Requires a non-empty AtomicBEEF (number[]/Uint8Array) OR resolves {txid,vout}
   * automatically from the selected token (no UI txid/vout fields needed).
   */
  async send(...raw: Array<any | string | number>): Promise<void> {
    // ---------- helpers ----------
    const isAtomicBEEFArray = (bp: any): boolean =>
      (Array.isArray(bp) &&
        bp.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) ||
      (bp instanceof Uint8Array && bp.length > 0);
    const isNonEmptyBeef = (bp: any): boolean => {
      if (!bp) return false;
      if (isAtomicBEEFArray(bp)) return (bp as any).length > 0;
      if (Array.isArray(bp.atomicBeef)) return bp.atomicBeef.length > 0;
      if (bp instanceof ArrayBuffer) return (bp as ArrayBuffer).byteLength > 0;
      return false;
    };
    const toNumberArray = (bp: any): number[] => {
      if (!bp) return [];
      if (Array.isArray(bp.atomicBeef)) return bp.atomicBeef as number[];
      if (bp instanceof Uint8Array) return Array.from(bp);
      if (bp instanceof ArrayBuffer) return Array.from(new Uint8Array(bp));
      if (Array.isArray(bp)) return bp as number[];
      return [];
    };
    const normHex = (h?: string): string => (h ? h.toLowerCase() : "");
    // -------------------------------------------------------------------------
    // helper: findOutpointForAsset (already updated)
    // -------------------------------------------------------------------------
    const findOutpointForAsset = async (
      assetId?: string,
    ): Promise<{ txid: TXIDHexString; vout: number } | null> => {
      const callId = makeDebugCallId("findOutpointForAsset");
      btmsDebug(`${callId}: start`, { assetId });
      if (!assetId) {
        btmsDebug(`${callId}: no assetId provided`);
        return null;
      }
      try {
        const wallet = walletClient;
        let outs: any[] = [];
        if (typeof wallet.listOutputs === "function") {
          const res = await wallet.listOutputs({
            basket: this.basket,
            limit: 500,
            offset: 0,
            includeCustomInstructions: true,
            seekPermission: false,
          });
          outs = Array.isArray(res?.outputs) ? res.outputs : [];
          btmsDebug(`${callId}: listOutputs ok`, {
            count: outs.length,
            keys: res ? Object.keys(res) : null,
          });
        } else {
          btmsDebug(`${callId}: no listOutputs on wallet`);
          return null;
        }
        for (const o of outs) {
          const script = extractLockingScriptFromWalletOutput(o);
          const decoded =
            (script ? decodeBTMSTokenFromScript(script) : null) ||
            decodeBTMSTokenFromCustomInstructions(o.customInstructions);
          if (!decoded) continue;
          if (decoded.assetId !== assetId) continue;
          if (typeof o.outpoint === "string") {
            const { txid, vout } = parseOutpoint(o.outpoint);
            if (txid && Number.isFinite(vout)) {
              btmsDebug(`${callId}: match via outpoint string`, { txid, vout });
              return { txid, vout };
            }
          }
          const txid = normHex(o.txid || "") as TXIDHexString;
          const vout = Number(o.vout);
          if (txid && Number.isFinite(vout)) {
            btmsDebug(`${callId}: match via txid/vout fields`, { txid, vout });
            return { txid, vout };
          }
        }
        btmsDebug(`${callId}: no match found for assetId`, { assetId });
        return null;
      } catch (e: any) {
        btmsDebug(`${callId}: error`, {
          message: e?.message,
          stackTop: String(e?.stack || "").split("\n")[0],
        });
        return null;
      }
    };
    // ---------- 1) normalize args ----------
    let args: any;
    if (raw.length === 1 && typeof raw[0] === "object" && raw[0] !== null) {
      args = raw[0];
    } else {
      const [assetId, recipientMaybe, amountMaybe, messageBox] = raw as [
        string | undefined,
        string | undefined,
        number | string | undefined,
        string | undefined,
      ];
      args = {
        assetId,
        amount:
          typeof amountMaybe === "string" ? Number(amountMaybe) : amountMaybe,
        recipient: recipientMaybe,
        recipientIdentityKey: recipientMaybe,
        identityKey: recipientMaybe,
        messageBox,
      };
    }
    // ---------- 2) pick recipient ----------
    const candidateRecipients = [
      args.recipient,
      args.recipientIdentityKey,
      args.identityKey,
      (args as any).recipientKey,
      (args as any).to,
      (args as any).target,
    ];
    const recipient = candidateRecipients
      .filter((x: any) => typeof x === "string")
      .map((x: string) => x.trim())
      .find((s) => !!s);
    if (!recipient) {
      btmsDebug("[BTMS.send] missing recipient", {
        keys: Object.keys(args || {}),
      });
      throw new Error("BTMS.send: recipient is required");
    }
    const {
      messageBox,
      recipient: _r1,
      recipientIdentityKey: _r2,
      identityKey: _r3,
      ...rest
    } = args;
    const fromArgOutpoint = parseOutpoint(
      (rest.outpoint as string) ||
        (rest.selectedOutput?.outpoint as string) ||
        (rest?.token?.outpoint as string),
    );
    const tokenTxid = normHex(rest?.token?.txid);
    const tokenVout = Number(rest?.token?.vout);
    let txidNorm = normHex(rest.txid || tokenTxid || fromArgOutpoint.txid);
    let voutNorm = Number.isFinite(Number(rest.vout))
      ? Number(rest.vout)
      : Number.isFinite(fromArgOutpoint.vout)
        ? fromArgOutpoint.vout
        : tokenVout;
    let haveOutpoint =
      !!txidNorm &&
      Number.isFinite(voutNorm) &&
      voutNorm >= 0 &&
      Number.isInteger(voutNorm);
    if (!haveOutpoint && rest.assetId) {
      const picked = await findOutpointForAsset(rest.assetId);
      if (picked) {
        txidNorm = normHex(picked.txid);
        voutNorm = picked.vout;
        haveOutpoint = true;
        btmsDebug("[BTMS.send] auto-selected outpoint", {
          assetId: rest.assetId,
          txid: txidNorm,
          vout: voutNorm,
        });
      }
    }
    btmsDebug("[BTMS.send] args summary", {
      recipient,
      assetId: rest.assetId,
      amount: rest.amount,
      haveOutpoint,
      txid: txidNorm,
      vout: voutNorm,
      hasBeefPayloadField: !!rest.beefPayload,
    });
    // ---------- 3) hydrate beefPayload ----------
    let beefPayload: any =
      rest.beefPayload ??
      rest.beef ??
      rest?.token?.beefPayload ??
      rest?.token?.beef ??
      null;
    // 3a) If we still don't have usable BEEF, try ls_btms via LookupResolver/HTTP
    if (!isNonEmptyBeef(beefPayload) && haveOutpoint) {
      try {
        const overlayResults = await this.findFromTokenOverlay({
          txid: txidNorm as TXIDHexString,
          vout: voutNorm,
        });
        const first = overlayResults[0];
        const atomicFromOverlay: number[] | undefined =
          first && (first as any).beef;
        if (Array.isArray(atomicFromOverlay) && atomicFromOverlay.length) {
          beefPayload = { atomicBeef: atomicFromOverlay };
          btmsDebug("[BTMS.send] hydrated beefPayload via overlay", {
            txid: txidNorm,
            vout: voutNorm,
            len: atomicFromOverlay.length,
          });
        } else {
          btmsDebug("[BTMS.send] overlay returned no beef for outpoint", {
            txid: txidNorm,
            vout: voutNorm,
          });
        }
      } catch (e: any) {
        btmsDebug("[BTMS.send] overlay hydration failed", {
          message: e?.message,
          txid: txidNorm,
          vout: voutNorm,
        });
      }
    }
    // ---------- 4) final beef check ----------
    const beefArray: number[] = toNumberArray(beefPayload);
    if (!beefArray.length) {
      throw new Error(
        `BTMS.send: beefPayload empty. OVERLAY_BASE=${OVERLAY_BASE}, haveOutpoint=${haveOutpoint}, txid=${txidNorm}, vout=${voutNorm}.`,
      );
    }
    // -------------------------------------------------------------------------
    // 5) Canonical new-world shape: { atomicBeef: number[] }
    // -------------------------------------------------------------------------
    const beefContainer = { atomicBeef: beefArray };
    // ---------- 6) final body ----------
    const body = {
      ...rest,
      token: rest.token ?? {
        txid: txidNorm || "",
        vout: Number.isFinite(voutNorm) ? voutNorm : 0,
        amount: typeof rest.amount === "number" ? rest.amount : 0,
        assetId: rest.assetId,
        beef: beefArray,
        beefPayload: beefContainer,
        keyID: rest.keyID ?? "default",
      },
      beef: beefArray,
      beefPayload: beefContainer,
    };
    btmsDebug("[BTMS.send] about to send message", {
      recipient,
      messageBox: messageBox || this.tokensMessageBox,
      bodyKeys: Object.keys(body),
      beefLen: beefArray.length,
    });
    // ---------- 7) send ----------
    await this.tokenator.sendMessage({
      recipient,
      messageBox: messageBox || this.tokensMessageBox,
      body,
    });
    btmsDebug("[BTMS.send] message sent OK", {
      recipient,
      txid: body.token.txid,
      vout: body.token.vout,
      beefLen: beefArray.length,
    });
  }
  private async findFromTokenOverlay(token: {
    txid: TXIDHexString;
    vout: number;
  }): Promise<OverlaySearchResult[]> {
    // Talk directly to the local overlay, same as your curl:
    // curl -X POST $OVERLAY_BASE/lookup \
    // -d '{"service":"ls_btms","query":{"txid":"...","vout":0}}'
    const base = (OVERLAY_BASE || "http://localhost:8080").replace(/\/+$/, "");
    const overlayUrl = `${base}/lookup`;
    const body = {
      service: "ls_btms",
      query: { txid: token.txid, vout: token.vout },
    };
    // Prefer global fetch in the browser; fall back to this.requester if needed
    const httpFetcher: (url: string, init?: RequestInit) => Promise<Response> =
      typeof fetch === "function" ? fetch.bind(globalThis) : this.requester;
    try {
      const res = await httpFetcher(overlayUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        btmsDebug("findFromTokenOverlay: HTTP non-OK", {
          status: res.status,
          overlayUrl,
          txid: token.txid,
          vout: token.vout,
        });
        return [];
      }
      const json = (await res.json()) as any;
      // Modern base-overlay shape:
      // { type: 'output-list', outputs: [ { beef: number[], ... } ] }
      if (json?.type === "output-list" && Array.isArray(json.outputs)) {
        const outputs: any[] = json.outputs;
        const normalized: OverlaySearchResult[] = outputs.flatMap(
          (out: any) => {
            try {
              const beef: number[] = out.beef ?? out.context;
              if (!Array.isArray(beef) || !beef.length) return [];
              const vout = Number(out.outputIndex ?? out.vout ?? token.vout);
              // The overlay may be storing full BRC-95 BEEF, not atomicBEEF.
              // Try atomic first (what WalletClient expects), then fall back.
              let tx: any;
              try {
                tx = Transaction.fromAtomicBEEF(beef);
              } catch {
                tx = Transaction.fromBEEF(beef);
              }
              const txid = tx.id("hex");
              const o = tx.outputs[vout];
              if (!o) return [];
              // derive lockingScript hex from tx output
              const ls: any = o.lockingScript;
              let lockingScript = "";
              if (ls && typeof ls.toHex === "function") {
                lockingScript = ls.toHex();
              } else if (ls instanceof Uint8Array) {
                lockingScript = Array.from(ls as Uint8Array)
                  .map((b) => b.toString(16).padStart(2, "0"))
                  .join("");
              } else if (Array.isArray(ls)) {
                lockingScript = (ls as any[])
                  .map((n) => Number(n).toString(16).padStart(2, "0"))
                  .join("");
              }
              const satoshis = Number(
                (o.satoshis as number) ?? 0,
              ) as SatoshiValue;
              return [
                {
                  txid,
                  vout,
                  rawTx: Utils.toHex(tx.toAtomicBEEF()),
                  lockingScript,
                  satoshis,
                  inputs: null,
                  mapiResponses: null,
                  proof: out.context ?? null,
                  beef,
                },
              ];
            } catch (innerErr: any) {
              btmsDebug(
                "findFromTokenOverlay: skipping output due to parse error",
                {
                  message: innerErr?.message,
                  txid: token.txid,
                  vout: token.vout,
                },
              );
              return [];
            }
          },
        );
        if (!normalized.length) {
          btmsDebug(
            "findFromTokenOverlay: HTTP output-list but no parsable entries",
            {
              overlayUrl,
              txid: token.txid,
              vout: token.vout,
            },
          );
        }
        return normalized;
      }
      // Legacy shapes (array/object). Keep tolerant behaviour.
      if (Array.isArray(json)) return json as OverlaySearchResult[];
      if (json && typeof json === "object")
        return [json as OverlaySearchResult];
      return [];
    } catch (err: any) {
      btmsDebug("findFromTokenOverlay: HTTP path failed", {
        message: err?.message,
        overlayUrl,
        txid: token.txid,
        vout: token.vout,
      });
      return [];
    }
  }
  private async submitToTokenOverlay(
    tx: any,
    topics = [this.tokenTopic],
  ): Promise<SubmitResult> {
    // 1) try SHIP if we have something tx-like
    try {
      const atomic = tx?.tx || tx?.atomicBeef || tx?.beef || tx?.rawTx;
      if (atomic) {
        const facilitator = new HTTPSOverlayBroadcastFacilitator(fetch, true);
        facilitator.allowHTTP = true;
        const broadcaster = new SHIPBroadcaster(topics, {
          networkPreset: "local" as const,
          facilitator,
          requireAcknowledgmentFromAnyHostForTopics: "any",
        });
        const t = Transaction.fromAtomicBEEF(atomic);
        await broadcaster.broadcast(t);
        // fabricate a SubmitResult so callers get the shape they expect
        return {
          status: "success",
          topics: {
            [topics[0]]: [0],
          },
        };
      }
    } catch (err: any) {
      btmsDebug(
        "submitToTokenOverlay: SHIP path failed, falling back to HTTP",
        {
          message: err?.message,
        },
      );
      // fall through to HTTP
    }
    // 2) HTTP fallback — this matches the overlay you’ve been curling
    const overlayUrl = "http://localhost:8080/submit";
    const body = {
      ...tx,
      topics,
      provider: "tm_btms",
    };
    const res = await this.requester(overlayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // your node wanted this:
        "x-topics": JSON.stringify(topics),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      btmsDebug("submitToTokenOverlay: HTTP non-OK", {
        status: res.status,
        text,
      });
      throw new Error(`Overlay submit failed: ${res.status}`);
    }
    const json = (await res.json()) as SubmitResult;
    btmsDebug("submitToTokenOverlay: HTTP success", json);
    return json;
  }
  async issue(...rawArgs: any[]): Promise<{
    assetId: string;
    amount: SatoshiValue;
    metadata: string;
    /** renamed from `envelope` */
    beefPayload?: any;
    atomicBeef: string | null;
  }> {
    // legacy positional
    if (rawArgs.length && typeof rawArgs[0] !== "object") {
      const [amountMaybe, nameOrAssetId, metadataMaybe] = rawArgs as [
        number | string,
        string | undefined,
        any,
      ];
      const amount = Number(amountMaybe ?? 1) as SatoshiValue;
      const assetId =
        nameOrAssetId || `asset_${Math.random().toString(36).slice(2, 10)}`;
      const normalizedMetadata =
        typeof metadataMaybe === "string"
          ? metadataMaybe
          : JSON.stringify(metadataMaybe ?? {});
      const tok = new BTMSToken();
      const lockingScriptObj = await tok.lock(
        this.protocolID,
        "default",
        "self",
        assetId,
        amount,
        normalizedMetadata,
        false,
      );
      const lockingScriptHex =
        typeof (lockingScriptObj as any).toHex === "function"
          ? (lockingScriptObj as any).toHex()
          : String(lockingScriptObj);
      btmsDebug("issue(positional) prepared lockingScript:", {
        isHex: isLikelyHex(lockingScriptHex),
        preview: shortHex(lockingScriptHex, 32),
        length: lockingScriptHex?.length,
      });
      // canonical BTMS beefPayload we want associated with this output
      const beefPayload = {
        protocolID: this.protocolID,
        assetId,
        amount,
        metadata: normalizedMetadata,
      };
      const action: any = await walletMint(
        lockingScriptHex,
        this.basket,
        this.satoshis,
        `Mint ${assetId} (${amount})`,
        beefPayload,
      );
      return {
        assetId,
        amount,
        metadata: normalizedMetadata,
        beefPayload,
        atomicBeef: action?.tx || action?.atomicBeef || action?.beef || null,
      };
    }
    // object style
    const args = (rawArgs[0] || {}) as {
      assetId?: string;
      amount?: SatoshiValue;
      metadata?: string | Record<string, any>;
      keyID?: KeyIDStringUnder800Bytes;
      counterparty?: WalletCounterparty;
      forSelf?: boolean;
    };
    const {
      assetId = `asset_${Math.random().toString(36).slice(2, 10)}`,
      amount = 1 as SatoshiValue,
      metadata = "",
      keyID = "default",
      counterparty = "self",
      forSelf = false,
    } = args;
    const normalizedMetadata: string =
      typeof metadata === "string" ? metadata : JSON.stringify(metadata ?? {});
    const tok = new BTMSToken();
    const lockingScriptObj = await tok.lock(
      this.protocolID,
      keyID,
      counterparty,
      assetId,
      amount,
      normalizedMetadata,
      forSelf,
    );
    const lockingScriptHex =
      typeof (lockingScriptObj as any).toHex === "function"
        ? (lockingScriptObj as any).toHex()
        : String(lockingScriptObj);
    btmsDebug(
      "issue(object) prepared lockingScript:",
      JSON.stringify({
        isHex: isLikelyHex(lockingScriptHex),
        preview: shortHex(lockingScriptHex, 32),
        length: lockingScriptHex?.length,
      }),
    );
    const beefPayload = {
      protocolID: this.protocolID,
      assetId,
      amount,
      metadata: normalizedMetadata,
    };
    const action: any = await walletMint(
      lockingScriptHex,
      this.basket,
      this.satoshis,
      `Mint ${assetId} (${amount})`,
      beefPayload,
    );
    return {
      assetId,
      amount,
      metadata: normalizedMetadata,
      beefPayload,
      atomicBeef: action?.tx || action?.atomicBeef || action?.beef || null,
    };
  }
}

/* ------------------------------------------------------------------ */
/* default export */
/* ------------------------------------------------------------------ */
const btmsInstance = new BTMS();
const defaultExport: any = btmsInstance;

defaultExport.listAssets = btmsInstance.listAssets.bind(btmsInstance);
defaultExport.issue = btmsInstance.issue.bind(btmsInstance);
defaultExport.listIncomingPayments =
  btmsInstance.listIncomingPayments.bind(btmsInstance);
defaultExport.getPublicKey = btmsInstance.getPublicKey.bind(btmsInstance);
defaultExport.acceptIncomingPayment =
  btmsInstance.acceptIncomingPayment.bind(btmsInstance);
defaultExport.refundIncomingTransaction =
  btmsInstance.refundIncomingTransaction.bind(btmsInstance);
defaultExport.send = btmsInstance.send.bind(btmsInstance);

// keep the static hook
(BTMS as any).listIncomingPayments =
  btmsInstance.listIncomingPayments.bind(btmsInstance);

btmsDebug("exported singleton btmsInstance", {
  instanceId: (btmsInstance as any).instanceId,
  source: BTMS_SOURCE_TAG,
});

// -------------------------------------------------------------------
// helper: acceptBTMSPayment (receiver side)
// -------------------------------------------------------------------
/**
 * Accept an incoming BTMS payment that was sent via MessageBox.
 * `beefPayload` is the wallet action you sent from sendBTMSToken.
 */
export async function acceptBTMSPayment(beefPayload: any): Promise<void> {
  const callId = makeDebugCallId("acceptBTMSPayment");
  btmsDebug(`${callId}: start`, { hasPayload: !!beefPayload });

  const anyPayload = beefPayload as any;
  const rawBeef =
    anyPayload?.tx ??
    anyPayload?.atomicBeef ??
    anyPayload?.beef ??
    anyPayload?.context;

  if (!rawBeef) {
    throw new Error("acceptBTMSPayment: no atomicBeef / tx found in payload");
  }

  const beefArray: number[] = Array.isArray(rawBeef)
    ? rawBeef.map((x: any) => Number(x))
    : (() => {
        throw new Error("acceptBTMSPayment: expected BEEF as number[]");
      })();

  const tx = Transaction.fromAtomicBEEF(beefArray);
  const txid = tx.id("hex");

  btmsDebug(`${callId}: rehydrated Transaction from BEEF`, {
    txid,
    outputs: tx.outputs.length,
  });

  const netRes = (await (walletClient as any).getNetwork?.()) || {
    network: "mainnet",
  };
  const networkName: string = netRes.network || "mainnet";
  const networkPreset = networkName === "testnet" ? "testnet" : "mainnet";

  const broadcaster = new SHIPBroadcaster(["tokens"], {
    networkPreset,
  });

  // ✅ correct usage: broadcaster broadcasts the transaction
  await broadcaster.broadcast(tx);

  btmsDebug(`${callId}: broadcast complete`, {
    txid,
    networkPreset,
  });
}

// -------------------------------------------------------------------
// helper: sendBTMSToken (sender side)
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
export async function sendBTMSToken(rawArgs: any): Promise<void> {
  const callId = makeDebugCallId("sendBTMSToken");
  btmsDebug(`${callId}: start`, { rawArgs });

  try {
    const args = rawArgs && typeof rawArgs === "object" ? { ...rawArgs } : {};
    const { assetId, recipient } = args;

    const amt =
      typeof args.amount === "string" ? Number(args.amount) : args.amount;

    if (!assetId || typeof assetId !== "string") {
      throw new Error("sendBTMSToken: assetId is required");
    }
    if (!recipient || typeof recipient !== "string") {
      throw new Error("sendBTMSToken: recipient identity key is required");
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      throw new Error("sendBTMSToken: amount must be a positive number");
    }

    const payload = {
      ...args,
      assetId,
      recipient,
      amount: amt,
    };

    btmsDebug(`${callId}: calling btmsInstance.send(...)`, {
      assetId,
      recipient,
      amount: amt,
      hasBeefPayload: !!payload.beefPayload,
      hasTokenBeef: !!payload.token?.beef || !!payload.token?.beefPayload,
    });

    await btmsInstance.send(payload);

    btmsDebug(`${callId}: btmsInstance.send(...) completed`, {
      assetId,
      recipient,
      amount: amt,
    });
  } catch (err: any) {
    btmsDebug(`${callId}: ERROR`, {
      message: err?.message,
      stackTop: String(err?.stack || "").split("\n")[0],
    });
    throw err;
  }
}

export { setBTMSAuthFetch, OverlayClient, btmsInstance as btms };
export default defaultExport;
