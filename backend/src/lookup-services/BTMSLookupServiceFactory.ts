// backend/src/lookup-services/BTMSLookupServiceFactory.ts

import {
  LookupService,
  LookupQuestion,
  AdmissionMode,
  SpendNotificationMode,
  OutputAdmittedByTopic,
  OutputSpent,
  LookupServiceMetaData,
  LookupFormula,
} from "@bsv/overlay";
import { Db } from "mongodb";
import {
  AtomicBEEF,
  BEEF,
  Byte,
  PositiveIntegerOrZero,
  Transaction,
  TXIDHexString,
} from "@bsv/sdk";
import { BTMSStorage } from "./BTMSStorage";
import docs from "./BTMSLookupDocs.md";

/**
 * Any BEEF-ish thing we might see on the payload.
 */
type BeefLike = BEEF | AtomicBEEF | Uint8Array;

interface WholeTxPayloadExtras {
  outputIndex?: number | string | PositiveIntegerOrZero;
  atomicBEEF?: AtomicBEEF;
  atomicBeef?: BeefLike;
  beef?: BeefLike;
  context?: BeefLike;
}

type LockingScriptBytes = Byte[];

type LockingScriptLike =
  | LockingScriptBytes
  | Uint8Array
  | Buffer
  | {
      toBytes?: () => Uint8Array;
      toBuffer?: () => Uint8Array | Buffer;
      toHex?: () => string;
    }
  | null
  | undefined;

type LooseQuery = {
  txid?: unknown;
  vout?: unknown;
  formula?: unknown;
  assetId?: unknown;
  findAll?: unknown;
  query?: unknown;
  service?: unknown;
};

type LookupEntry = LookupFormula[number];

type ExtendedLookupEntry = LookupEntry & {
  beef?: AtomicBEEF;
  lockingScript?: LockingScriptBytes;
};

/**
 * BTMS lookup service (pushdrop-free).
 *
 *  - Admit outputs and store minimal info.
 *  - The overlay engine expects `lookup` to return a LookupFormula:
 *      Array<{ txid: TXIDHexString; outputIndex: PositiveIntegerOrZero; history?; context? }>
 *
 * For compatibility with BTMS.send → findFromTokenOverlay:
 *  - On an exact outpoint query ({ txid, vout }), we return a single
 *    LookupFormula element and also include `beef` and `lockingScript`
 *    fields as extra properties (permitted at runtime, TS-cast in code).
 *
 * We still do NOT:
 *  - decode pushdrop
 *  - infer assetId/amount/metadata from the script on the overlay
 */
class BTMSLookupService implements LookupService {
  // We want the whole transaction admitted (AtomicBEEF / BEEF available via context).
  readonly admissionMode: AdmissionMode = "whole-tx";
  readonly spendNotificationMode: SpendNotificationMode = "none";

  constructor(public storage: BTMSStorage) {
    // 🔊 Log once when the service is constructed so we know this version loaded.
    console.log(
      "[BTMSLookupService] constructed",
      JSON.stringify(
        {
          admissionMode: this.admissionMode,
          spendNotificationMode: this.spendNotificationMode,
        },
        null,
        2,
      ),
    );
  }

  async getDocumentation(): Promise<string> {
    return docs;
  }

  async getMetaData(): Promise<LookupServiceMetaData> {
    return {
      name: "BTMS Lookup Service",
      shortDescription:
        "Indexes BTMS UTXOs; supports findAll / by-asset / by-outpoint (no PushDrop).",
    };
  }

  /**
   * Admit handler — for whole-tx mode.
   *
   * OutputAdmittedByTopic (whole-tx) looks like:
   *   { mode: 'whole-tx', atomicBEEF: number[], outputIndex: PositiveIntegerOrZero, topic: string, ... }
   *
   * We:
   *  - parse atomicBEEF / BEEF → Transaction
   *  - derive txid + lockingScript for the admitted outputIndex
   *  - save { txid, outputIndex, beef:AtomicBEEF, lockingScript:Byte[] }
   */
  async outputAdmittedByTopic(payload: OutputAdmittedByTopic): Promise<void> {
    if (payload.mode !== "whole-tx") {
      console.log(
        "[BTMSLookupService] outputAdmittedByTopic: skipping payload with non-whole-tx mode",
        JSON.stringify(
          {
            mode: payload.mode,
          },
          null,
          2,
        ),
      );
      return;
    }

    const wholePayload = payload as OutputAdmittedByTopic &
      WholeTxPayloadExtras;

    const outputIndex = Number(
      wholePayload.outputIndex ?? 0,
    ) as PositiveIntegerOrZero;

    const atomicBEEFSource: BeefLike | undefined =
      wholePayload.atomicBEEF ??
      wholePayload.atomicBeef ??
      wholePayload.beef ??
      wholePayload.context;

    if (!atomicBEEFSource) {
      console.log(
        "[BTMSLookupService] outputAdmittedByTopic: no atomicBEEF/BEEF on payload",
        JSON.stringify(
          {
            mode: payload.mode,
            outputIndex,
          },
          null,
          2,
        ),
      );
      return;
    }

    let beef: AtomicBEEF | undefined;

    if (Array.isArray(atomicBEEFSource)) {
      beef = atomicBEEFSource.map((x) => Number(x)) as AtomicBEEF;
    } else if (atomicBEEFSource instanceof Uint8Array) {
      beef = Array.from(atomicBEEFSource, (b) => Number(b)) as AtomicBEEF;
    } else {
      const ctorName =
        (atomicBEEFSource as { constructor?: { name?: string } })?.constructor
          ?.name ?? "unknown";
      console.log(
        "[BTMSLookupService] outputAdmittedByTopic: unsupported atomicBEEF/BEEF type",
        JSON.stringify(
          {
            type: typeof atomicBEEFSource,
            constructor: ctorName,
          },
          null,
          2,
        ),
      );
      return;
    }

    try {
      // 🔴 IMPORTANT CHANGE: be tolerant of both atomicBEEF and full BEEF
      let tx: Transaction;
      try {
        tx = Transaction.fromAtomicBEEF(beef as AtomicBEEF);
      } catch {
        tx = Transaction.fromBEEF(beef as BEEF);
      }
      // 🔴 END CHANGE

      const txid = tx.id("hex") as TXIDHexString;

      const o = tx.outputs[outputIndex];
      if (!o) {
        console.log(
          "[BTMSLookupService] outputAdmittedByTopic: no output at index",
          JSON.stringify(
            {
              txid,
              outputIndex,
              outputsLength: tx.outputs.length,
            },
            null,
            2,
          ),
        );
        return;
      }

      // 🔐 Safely normalise lockingScript into Byte[] without assuming a specific SDK shape.
      let lockingScriptBytes: LockingScriptBytes | undefined;
      const ls: LockingScriptLike = o.lockingScript as LockingScriptLike;

      if (ls == null) {
        // no lockingScript present; we'll just store beef + outpoint
        console.log(
          "[BTMSLookupService] outputAdmittedByTopic: output has no lockingScript",
          JSON.stringify(
            {
              txid,
              outputIndex,
            },
            null,
            2,
          ),
        );
      } else if (Array.isArray(ls)) {
        lockingScriptBytes = ls.map((n) => Number(n)) as LockingScriptBytes;
      } else if (ls instanceof Uint8Array) {
        lockingScriptBytes = Array.from(ls, (b) =>
          Number(b),
        ) as LockingScriptBytes;
      } else if (typeof Buffer !== "undefined" && Buffer.isBuffer(ls)) {
        lockingScriptBytes = Array.from(ls, (b) =>
          Number(b),
        ) as LockingScriptBytes;
      } else if (typeof ls.toBytes === "function") {
        const u8 = ls.toBytes();
        lockingScriptBytes = Array.from(u8, (b) =>
          Number(b),
        ) as LockingScriptBytes;
      } else if (typeof ls.toBuffer === "function") {
        const buf = ls.toBuffer();
        lockingScriptBytes = Array.from(buf as Uint8Array | Buffer, (b) =>
          Number(b),
        ) as LockingScriptBytes;
      } else if (typeof ls.toHex === "function") {
        // 👉 Script-like object with toHex()
        const hex = ls.toHex();
        if (typeof hex === "string") {
          const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
          if (clean.length % 2 === 0) {
            const bytes: number[] = [];
            for (let i = 0; i < clean.length; i += 2) {
              const byte = parseInt(clean.slice(i, i + 2), 16);
              if (!Number.isNaN(byte)) bytes.push(byte);
            }
            lockingScriptBytes = bytes as LockingScriptBytes;
          }
        }
      } else {
        const ctorName =
          (ls as { constructor?: { name?: string } })?.constructor?.name ??
          "unknown";
        console.log(
          "[BTMSLookupService] outputAdmittedByTopic: unsupported lockingScript shape",
          JSON.stringify(
            {
              txid,
              outputIndex,
              lockingScriptType: typeof ls,
              lockingScriptCtor: ctorName,
            },
            null,
            2,
          ),
        );
      }

      console.log(
        "[BTMSLookupService] outputAdmittedByTopic: saving record",
        JSON.stringify(
          {
            txid,
            outputIndex,
            hasBeef: Array.isArray(beef),
            beefLength: Array.isArray(beef) ? beef.length : 0,
            hasLockingScript: Array.isArray(lockingScriptBytes),
            lockingScriptLength: lockingScriptBytes
              ? lockingScriptBytes.length
              : 0,
          },
          null,
          2,
        ),
      );

      // Persist minimal record; assetId/amount/metadata are intentionally omitted
      await this.storage.saveOnAdmit({
        txid,
        outputIndex,
        beef,
        lockingScript: lockingScriptBytes,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : `Unknown error: ${String(err)}`;
      console.log(
        "[BTMSLookupService] outputAdmittedByTopic: error parsing BEEF/atomicBEEF",
        JSON.stringify(
          {
            message,
            outputIndex,
            beefLength: Array.isArray(beef) ? beef.length : 0,
          },
          null,
          2,
        ),
      );
    }
  }

  async outputSpent(_payload: OutputSpent): Promise<void> {
    // no-op for now
  }

  async outputEvicted(
    _txid: TXIDHexString,
    _outputIndex: PositiveIntegerOrZero,
  ): Promise<void> {
    // no-op for now
  }

  /**
   * Lookup handler.
   *
   * Contract (from LookupService):
   *   lookup(question) => Promise<LookupFormula>
   *   LookupFormula = Array<{
   *     txid: TXIDHexString
   *     outputIndex: PositiveIntegerOrZero
   *     history?: number | ((...) => Promise<boolean>)
   *     context?: number[]
   *   }>
   *
   * For BTMS:
   *  - Exact outpoint ({ txid, vout }) returns a single element, with:
   *      { txid, outputIndex, context?: number[], beef?: AtomicBEEF, lockingScript?: Byte[] }
   *    (`beef` and `lockingScript` are extra runtime fields; we cast to keep TS happy).
   *
   *  - "findAll" / "findByAssetId" return a simple array of { txid, outputIndex }.
   */
  async lookup(question: LookupQuestion): Promise<LookupFormula> {
    // Normalize query shape (accept {service,query:{...}} or flat)
    const src = question as LooseQuery;
    const innerQuery =
      src.query && typeof src.query === "object" && src.query !== null
        ? (src.query as Record<string, unknown>)
        : (src as Record<string, unknown>);
    const q: LooseQuery = innerQuery as LooseQuery;

    // 1) Exact outpoint (Meter-style): { txid, vout }
    if (
      typeof q.txid === "string" &&
      typeof q.vout === "number" &&
      Number.isFinite(q.vout)
    ) {
      const txid = q.txid as string;
      const outputIndex = q.vout as number;

      console.log(
        "[BTMSLookupService] lookup: exact outpoint query",
        JSON.stringify(
          {
            txid,
            vout: outputIndex,
          },
          null,
          2,
        ),
      );

      // Use the dedicated helper so we don't have to scan the whole collection.
      const match = await this.storage.findByOutpoint(txid, outputIndex);

      if (!match) {
        console.log(
          "[BTMSLookupService] lookup: no BTMSRecord found for outpoint",
          JSON.stringify({ txid, vout: outputIndex }, null, 2),
        );
        return [];
      }

      console.log(
        "[BTMSLookupService] lookup: BTMSRecord match",
        JSON.stringify(
          {
            txid: match.txid,
            outputIndex: match.outputIndex,
            hasBeef: Array.isArray(match.beef),
            beefLength: Array.isArray(match.beef) ? match.beef.length : 0,
            hasLockingScript: Array.isArray(match.lockingScript),
            lockingScriptLength: Array.isArray(match.lockingScript)
              ? match.lockingScript.length
              : 0,
          },
          null,
          2,
        ),
      );

      const entry: ExtendedLookupEntry = {
        txid: match.txid as TXIDHexString,
        outputIndex: match.outputIndex as PositiveIntegerOrZero,
      };

      if (Array.isArray(match.beef)) {
        entry.context = match.beef; // standard field
        entry.beef = match.beef as AtomicBEEF; // extra, for convenience
      }

      if (Array.isArray(match.lockingScript)) {
        entry.lockingScript = match.lockingScript as LockingScriptBytes;
      }

      return [entry] as LookupFormula;
    }

    // 2) Named formula or boolean flag (legacy shapes)
    const formula: string | undefined =
      typeof q.formula === "string"
        ? (q.formula as string)
        : q.findAll
          ? "findAll"
          : undefined;

    if (formula === "findAll") {
      console.log("[BTMSLookupService] lookup: formula=findAll");
      const docs = await this.storage.findAll();
      return docs.map(
        (d): LookupEntry => ({
          txid: d.txid as TXIDHexString,
          outputIndex: d.outputIndex as PositiveIntegerOrZero,
        }),
      ) as LookupFormula;
    }

    if (formula === "findByAssetId" || typeof q.assetId === "string") {
      const assetId: string = String(q.assetId ?? "");
      console.log(
        "[BTMSLookupService] lookup: formula=findByAssetId",
        JSON.stringify({ assetId }, null, 2),
      );
      if (!assetId) return [];
      const docs = await this.storage.findByAssetId(assetId);
      return docs.map(
        (d): LookupEntry => ({
          txid: d.txid as TXIDHexString,
          outputIndex: d.outputIndex as PositiveIntegerOrZero,
        }),
      ) as LookupFormula;
    }

    console.log(
      "[BTMSLookupService] lookup: default/unknown query shape",
      JSON.stringify(q, null, 2),
    );

    // Default: empty array
    return [];
  }
}

/** Factory */
export default (db: Db): BTMSLookupService => {
  return new BTMSLookupService(new BTMSStorage(db));
};
