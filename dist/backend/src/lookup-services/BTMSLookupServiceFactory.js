"use strict";
// backend/src/lookup-services/BTMSLookupServiceFactory.ts
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@bsv/sdk");
const BTMSStorage_1 = require("./BTMSStorage");
const BTMSLookupDocs_md_1 = __importDefault(require("./BTMSLookupDocs.md"));
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
class BTMSLookupService {
  constructor(storage) {
    this.storage = storage;
    // We want the whole transaction admitted (AtomicBEEF / BEEF available via context).
    this.admissionMode = "whole-tx";
    this.spendNotificationMode = "none";
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
  async getDocumentation() {
    return BTMSLookupDocs_md_1.default;
  }
  async getMetaData() {
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
   *  - save { txid, outputIndex, beef:number[], lockingScript:number[] }
   */
  async outputAdmittedByTopic(payload) {
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
    const anyPayload = payload;
    const outputIndex = Number(anyPayload.outputIndex);
    const atomicBEEFSource =
      anyPayload.atomicBEEF ??
      anyPayload.atomicBeef ??
      anyPayload.beef ??
      anyPayload.context;
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
    let beef;
    if (Array.isArray(atomicBEEFSource)) {
      beef = atomicBEEFSource.map((x) => Number(x));
    } else if (atomicBEEFSource instanceof Uint8Array) {
      beef = Array.from(atomicBEEFSource, (b) => Number(b));
    } else {
      console.log(
        "[BTMSLookupService] outputAdmittedByTopic: unsupported atomicBEEF/BEEF type",
        JSON.stringify(
          {
            type: typeof atomicBEEFSource,
            constructor: atomicBEEFSource?.constructor?.name,
          },
          null,
          2,
        ),
      );
      return;
    }
    try {
      // 🔴 IMPORTANT CHANGE: be tolerant of both atomicBEEF and full BEEF
      let tx;
      try {
        tx = sdk_1.Transaction.fromAtomicBEEF(beef);
      } catch {
        tx = sdk_1.Transaction.fromBEEF(beef);
      }
      // 🔴 END CHANGE
      const txid = tx.id("hex");
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
      // 🔐 Safely normalise lockingScript into number[] without assuming a specific SDK shape.
      let lockingScriptBytes;
      const ls = o.lockingScript;
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
        lockingScriptBytes = ls.map((n) => Number(n));
      } else if (ls instanceof Uint8Array) {
        lockingScriptBytes = Array.from(ls, (b) => Number(b));
      } else if (typeof Buffer !== "undefined" && Buffer.isBuffer(ls)) {
        lockingScriptBytes = Array.from(ls, (b) => Number(b));
      } else if (typeof ls.toBytes === "function") {
        const u8 = ls.toBytes();
        lockingScriptBytes = Array.from(u8, (b) => Number(b));
      } else if (typeof ls.toBuffer === "function") {
        const buf = ls.toBuffer();
        lockingScriptBytes = Array.from(buf, (b) => Number(b));
      } else if (typeof ls.toHex === "function") {
        // 👉 Script-like object with toHex()
        const hex = ls.toHex();
        if (typeof hex === "string") {
          const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
          if (clean.length % 2 === 0) {
            const bytes = [];
            for (let i = 0; i < clean.length; i += 2) {
              const byte = parseInt(clean.slice(i, i + 2), 16);
              if (!Number.isNaN(byte)) bytes.push(byte);
            }
            lockingScriptBytes = bytes;
          }
        }
      } else {
        console.log(
          "[BTMSLookupService] outputAdmittedByTopic: unsupported lockingScript shape",
          JSON.stringify(
            {
              txid,
              outputIndex,
              lockingScriptType: typeof ls,
              lockingScriptCtor: ls?.constructor?.name,
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
    } catch (err) {
      console.log(
        "[BTMSLookupService] outputAdmittedByTopic: error parsing BEEF/atomicBEEF",
        JSON.stringify(
          {
            message: err?.message,
            outputIndex,
            beefLength: Array.isArray(beef) ? beef.length : 0,
          },
          null,
          2,
        ),
      );
    }
  }
  async outputSpent(_payload) {
    // no-op for now
  }
  async outputEvicted(_txid, _outputIndex) {
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
   *      { txid, outputIndex, context?: number[], beef?: number[], lockingScript?: number[] }
   *    (`beef` and `lockingScript` are extra runtime fields; we cast to keep TS happy).
   *
   *  - "findAll" / "findByAssetId" return a simple array of { txid, outputIndex }.
   */
  async lookup(question) {
    // Normalize query shape (accept {service,query:{...}} or flat)
    const src = question;
    const q =
      src && typeof src.query === "object" && src.query !== null
        ? src.query
        : src;
    // 1) Exact outpoint (Meter-style): { txid, vout }
    if (typeof q?.txid === "string" && Number.isFinite(q?.vout)) {
      const txid = q.txid;
      const outputIndex = Number(q.vout);
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
      // Include beef/lockingScript as extra fields so downstream
      // (HTTP bridge / LookupResolver) can expose them.
      const entry = {
        txid: match.txid,
        outputIndex: match.outputIndex,
      };
      if (Array.isArray(match.beef)) {
        entry.context = match.beef; // standard field
        entry.beef = match.beef; // extra, for convenience
      }
      if (Array.isArray(match.lockingScript)) {
        entry.lockingScript = match.lockingScript;
      }
      return [entry];
    }
    // 2) Named formula or boolean flag (legacy shapes)
    const formula =
      typeof q?.formula === "string"
        ? q.formula
        : q?.findAll
          ? "findAll"
          : undefined;
    if (formula === "findAll") {
      console.log("[BTMSLookupService] lookup: formula=findAll");
      const docs = await this.storage.findAll();
      return docs.map((d) => ({
        txid: d.txid,
        outputIndex: d.outputIndex,
      }));
    }
    if (formula === "findByAssetId" || typeof q?.assetId === "string") {
      const assetId = String(q.assetId ?? "");
      console.log(
        "[BTMSLookupService] lookup: formula=findByAssetId",
        JSON.stringify({ assetId }, null, 2),
      );
      if (!assetId) return [];
      const docs = await this.storage.findByAssetId(assetId);
      return docs.map((d) => ({
        txid: d.txid,
        outputIndex: d.outputIndex,
      }));
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
exports.default = (db) => {
  return new BTMSLookupService(new BTMSStorage_1.BTMSStorage(db));
};
