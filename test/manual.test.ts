import { BTMS } from '..'

describe('manual tests', () => {
    jest.setTimeout(99999999)

    test('0_add an asset', async () => {
        const btms = new BTMS()

        const r = await btms.issue(42, 'xyloFronds')
        expect(r).toBeTruthy()
        /* seeing...
        {status: 'error', code: 'ERR_EXTSVS_MERKLEROOT_MISSING', description: 'MerkleRoot ed73291abb0a146d2b673880b03d6f7…3e22d2879cb was not found in active chain.'}
        */
    })
})