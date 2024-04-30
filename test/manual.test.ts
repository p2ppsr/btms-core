import { BTMS } from '..'

describe('manual tests', () => {
    jest.setTimeout(99999999)

    test('0_add an asset', async () => {
        const btms = new BTMS()

        const r = await btms.issue(16, 'vestal virgins')
        expect(r).toBeTruthy()
        /* seeing...
        {status: 'error', code: 'ERR_EXTSVS_MERKLEROOT_MISSING', description: 'MerkleRoot ed73291abb0a146d2b673880b03d6f7…3e22d2879cb was not found in active chain.'}
        */
    })

    test('1_list assets', async () => {
        const btms = new BTMS()

        const r = await btms.listAssets()
        expect(r).toBeTruthy()
        /* seeing...
        [{
            name: 'xyloFronds',
            balance: 42,
            metadata: '{"name":"xyloFronds"}',
            assetId: '1187f30e63332f9e8ed8b9e779bffd06be48214722d9998df988e5ec8576d5b1.0'
        }]
        */
    })
})