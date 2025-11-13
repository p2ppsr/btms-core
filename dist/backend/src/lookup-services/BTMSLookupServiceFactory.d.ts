import { LookupService, LookupQuestion, AdmissionMode, SpendNotificationMode, OutputAdmittedByTopic, OutputSpent, LookupServiceMetaData } from '@bsv/overlay';
import { Db } from 'mongodb';
import { BTMSStorage } from './BTMSStorage';
/**
 * BTMS lookup service:
 *  - Admit locking-script outputs and store minimal info.
 *  - Lookups MUST return a **PLAIN ARRAY** (engine maps over it).
 *    Here we return Meter-style rows:
 *      { txid, outputIndex, context?: number[] }
 *    where `context` holds AtomicBEEF bytes.
 */
declare class BTMSLookupService implements LookupService {
    storage: BTMSStorage;
    readonly admissionMode: AdmissionMode;
    readonly spendNotificationMode: SpendNotificationMode;
    constructor(storage: BTMSStorage);
    getDocumentation(): Promise<string>;
    getMetaData(): Promise<LookupServiceMetaData>;
    /**
     * Admit handler — only for locking-script mode.
     * Stores: { txid, outputIndex, assetId?, amount?, metadata?, beef?, lockingScript? }
     *
     * Core shape (txid, outputIndex, assetId, amount, metadata) stays the same
     * as your original 4 tokens. `beef` and `lockingScript` are additive.
     */
    outputAdmittedByTopic(payload: OutputAdmittedByTopic): Promise<void>;
    outputSpent(_payload: OutputSpent): Promise<void>;
    outputEvicted(_txid: string, _outputIndex: number): Promise<void>;
    /**
     * IMPORTANT: Return a **plain array** for ALL code paths.
     * We normalize to Meter-style:
     *   { txid, outputIndex, context?: number[] }
     *
     * Overlay engine will wrap this in the usual HTTP JSON:
     *   { type: "output-list", outputs: [...] }
     * so your existing curl /lookup examples keep working.
     */
    lookup(question: LookupQuestion): Promise<Array<{
        txid: string;
        outputIndex: number;
        context?: number[];
    }>>;
}
/** Factory */
declare const _default: (db: Db) => BTMSLookupService;
export default _default;
