import { MarketplaceOffer, BTMS } from '../src'

describe('manual tests', () => {
    jest.setTimeout(99999999)

    test('0_add an asset', async () => {
        const btms = new BTMS()

        const r = await btms.issue(5, 'golden eggs')
        expect(r).toBeTruthy()
        /* seeing...
        {status: 'error', code: 'ERR_EXTSVS_MERKLEROOT_MISSING', description: 'MerkleRoot ed73291abb0a146d2b673880b03d6f7…3e22d2879cb was not found in active chain.'}
        */
    })

    test('1_listAssets', async () => {
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

    test('2_findAllAssetsForSale', async () => {
        const btms = new BTMS()

        const findMine = false
        const r = await btms.findAllAssetsForSale(findMine)
        expect(r).toBeTruthy()
        /* seeing...
        throws error
        assets is not iterable
        "ERR_LOOKUP_SERVICE_NOT_SUPPORTED"
        */
    })

    test('3_listOutgoingOffers', async () => {
        const btms = new BTMS()

        const r = await btms.listOutgoingOffers()
        expect(r.length).toBeGreaterThanOrEqual(0)
        /* seeing...
        []
        */
    })
    
    test('4_listIncomingOffers', async () => {
        const btms = new BTMS()

        const r = await btms.listIncomingOffers()
        expect(r.length).toBeGreaterThanOrEqual(0)
        /* seeing...
        throws error
        assets is not iterable
        "ERR_LOOKUP_SERVICE_NOT_SUPPORTED"
        */
    })
    
    test('5_create MarketplaceOffer', async () => {

        const mpo: MarketplaceOffer = {
            buyerOffersAssetId: '',
            buyerOffersAmount: 0,
            buyerProof: undefined,
            buyerPartialTX: '',
            buyerFundingEnvelope: undefined,
            sellerEntry: undefined,
            fundingKeyID: ''
        }
    })
})