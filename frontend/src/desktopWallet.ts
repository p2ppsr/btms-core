// frontend/src/desktopWallet.ts
import { WalletClient } from "@bsv/sdk";

const walletClient = new WalletClient();
console.log('walletClient:', walletClient)
export const desktopWallet = {
  // try the real wallet first
  async getPublicKey(args: {
    identityKey?: true;
    protocolID?: [number, string];
    keyID?: string;
    counterparty?: "self" | "anyone" | string;
    forSelf?: boolean;
  }): Promise<string> {
    // 1) try SDK path (2121/3301)
    try {
      console.log('args:', args)
      const { publicKey } = await walletClient.getPublicKey(args);
      return publicKey;
    } catch (e) {
      // fall through to the 3321 shape
      console.warn("[desktopWallet] SDK getPublicKey failed, trying 3321", e);
    }
    return ''
  },
};
