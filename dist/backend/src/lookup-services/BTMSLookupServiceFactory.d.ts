import { LookupService, LookupQuestion, AdmissionMode, SpendNotificationMode, OutputAdmittedByTopic, OutputSpent, LookupServiceMetaData, LookupFormula } from '@bsv/overlay';
import { Db } from 'mongodb';
import { PositiveIntegerOrZero, TXIDHexString } from '@bsv/sdk';
import { BTMSStorage } from './BTMSStorage';
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
 *
 * NOTE (2025-11-20):
 *  - A future formula `"history"` is defined in `lookup()` as a stub for
 *    `GET /overlay/ls_btms/history?identityKey=<active>`.
 *    Implementation of that formula requires extending BTMSStorage to
 *    actually persist per-identity history rows (sends, incoming,
 *    internalization events, refunds).
 */
declare class BTMSLookupService implements LookupService {
    storage: BTMSStorage;
    readonly admissionMode: AdmissionMode;
    readonly spendNotificationMode: SpendNotificationMode;
    constructor(storage: BTMSStorage);
    getDocumentation(): Promise<string>;
    getMetaData(): Promise<LookupServiceMetaData>;
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
    outputAdmittedByTopic(payload: OutputAdmittedByTopic): Promise<void>;
    outputSpent(_payload: OutputSpent): Promise<void>;
    outputEvicted(_txid: TXIDHexString, _outputIndex: PositiveIntegerOrZero): Promise<void>;
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
     *
     *  - "history" (stub) will eventually back:
     *      GET /overlay/ls_btms/history?identityKey=<active>
     *    but currently returns [] until BTMSStorage is extended to store
     *    per-identity event rows.
     */
    lookup(question: LookupQuestion): Promise<LookupFormula>;
}
/** Factory */
declare const _default: (db: Db) => BTMSLookupService;
export default _default;
