import { AdmittanceInstructions, TopicManager } from "@bsv/overlay";
/**
 * BTMS Topic Manager (pushdrop-free).
 *
 * For the **original BTMS demo flow**, we do *not* try to parse or
 * validate the token structure here. We simply:
 *
 *  - Parse the BEEF into a Transaction
 *  - Admit all outputs (or as many as we can safely handle)
 *  - Let higher-level code / the wallet decide what is “really” BTMS
 *
 * This keeps the overlay running reliably and avoids any dependency
 * on the separate `pushdrop` package or BRC-48 conventions.
 */
export default class BTMSTopicManager implements TopicManager {
  /**
   * Decide which outputs from the submitted tx should be admitted to this topic.
   * For the original BTMS behavior, we simply admit all outputs that parse OK.
   */
  identifyAdmissibleOutputs(
    beef: number[],
    previousCoins: number[],
  ): Promise<AdmittanceInstructions>;
  getDocumentation(): Promise<string>;
  getMetaData(): Promise<{
    name: string;
    shortDescription: string;
    iconURL?: string;
    version?: string;
    informationURL?: string;
  }>;
}
