"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// test.ts
const index_1 = require("./src/index");
async function main() {
    const btms = new index_1.BTMS();
    console.log('valid?', btms.validateAssetId('a'.repeat(64) + '.0'));
}
main().catch(console.error);
//# sourceMappingURL=test.js.map