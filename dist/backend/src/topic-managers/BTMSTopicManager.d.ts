import { AdmittanceInstructions, TopicManager } from '@bsv/overlay';
/**
 * Admits outputs that look like BTMS / pushdrop token outputs.
 * Very similar in shape to BTMSTopicManager, but instead of parsing an sCrypt
 * contract, we just try pushdrop.decode(...) on each output script.
 */
export default class BTMSTopicManager implements TopicManager {
    /**
     * Decide which outputs from the submitted tx should be admitted to this topic.
     */
    identifyAdmissibleOutputs(beef: number[], previousCoins: number[]): Promise<AdmittanceInstructions>;
    getDocumentation(): Promise<string>;
    getMetaData(): Promise<{
        name: string;
        shortDescription: string;
        iconURL?: string;
        version?: string;
        informationURL?: string;
    }>;
}
