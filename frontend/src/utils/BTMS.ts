//
// Thin facade so the UI can import the btms singleton and helpers
// from a single place.
//

import * as btmsCoreModule from "btms-core";

// Resolve the core singleton instance (default or named exports).
// This covers both the built package and local dev builds.
const btms: any =
  (btmsCoreModule as any).default ??
  (btmsCoreModule as any).btms ??
  (btmsCoreModule as any);

// Ensure the singleton has the helpers we expect, even if they only
// exist as named exports or static methods on BTMS in btms-core.
function attachIfMissing(prop: string) {
  if (btms && btms[prop]) return;

  if ((btmsCoreModule as any)[prop]) {
    btms[prop] = (btmsCoreModule as any)[prop];
    return;
  }

  if ((btmsCoreModule as any).BTMS && (btmsCoreModule as any).BTMS[prop]) {
    btms[prop] = (btmsCoreModule as any).BTMS[prop];
  }
}

// These are the helpers the frontend expects to call on BTMS.
[
  "listIncomingPayments",
  "acceptIncomingPayment",
  "refundIncomingTransaction",
  "send",
].forEach(attachIfMissing);

// Keep existing behaviour: default export acts like the singleton instance.
export default btms;

// Also export as a named value for places that prefer `import { btms } ...`
export { btms };

// Named helper: delegate to the core helper (btms-core).
export async function sendBTMSToken(args: any): Promise<void> {
  const coreSendBTMSToken: any = (btmsCoreModule as any).sendBTMSToken;
  const fn =
    typeof coreSendBTMSToken === "function"
      ? coreSendBTMSToken
      : typeof btms?.sendBTMSToken === "function"
        ? btms.sendBTMSToken
        : typeof btms?.send === "function"
          ? btms.send
          : null;

  if (!fn) {
    throw new Error("sendBTMSToken is not available on btms-core");
  }

  return fn(args);
}
