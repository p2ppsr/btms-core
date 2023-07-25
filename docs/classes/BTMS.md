[btms-core](../README.md) / [Exports](../modules.md) / BTMS

# Class: BTMS

The BTMS class provides an interface for managing and transacting assets using the Babbage SDK.

## Table of contents

### Constructors

- [constructor](BTMS.md#constructor)

### Properties

- [basket](BTMS.md#basket)
- [confederacyHost](BTMS.md#confederacyhost)
- [messageBox](BTMS.md#messagebox)
- [peerServHost](BTMS.md#peerservhost)
- [protocolID](BTMS.md#protocolid)
- [satoshis](BTMS.md#satoshis)
- [tokenator](BTMS.md#tokenator)
- [topic](BTMS.md#topic)

### Methods

- [acceptIncomingPayment](BTMS.md#acceptincomingpayment)
- [getBalance](BTMS.md#getbalance)
- [getTokens](BTMS.md#gettokens)
- [getTransactions](BTMS.md#gettransactions)
- [listAssets](BTMS.md#listassets)
- [listIncomingPayments](BTMS.md#listincomingpayments)
- [proveOwnership](BTMS.md#proveownership)
- [refundIncomingTransaction](BTMS.md#refundincomingtransaction)
- [send](BTMS.md#send)
- [verifyOwnership](BTMS.md#verifyownership)

## Constructors

### constructor

• **new BTMS**(`confederacyHost?`, `peerServHost?`, `messageBox?`, `protocolID?`, `basket?`, `topic?`, `satoshis?`)

BTMS constructor.

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `confederacyHost` | `string` | `'https://confederacy.babbage.systems'` | The confederacy host URL. |
| `peerServHost` | `string` | `'https://peerserv.babbage.systems'` | The peer service host URL. |
| `messageBox` | `string` | `'TyPoints-Box'` | The message box ID. |
| `protocolID` | `string` | `'tokens'` | The protocol ID. |
| `basket` | `string` | `'TyPoints2'` | The asset basket ID. |
| `topic` | `string` | `'TyPoints'` | The topic associated with the asset. |
| `satoshis` | `number` | `1000` | The number of satoshis involved in transactions. |

#### Defined in

[index.ts:31](https://github.com/p2ppsr/btms-core/blob/b9d8bb3/src/index.ts#L31)

## Properties

### basket

• **basket**: `string`

#### Defined in

[index.ts:16](https://github.com/p2ppsr/btms-core/blob/b9d8bb3/src/index.ts#L16)

___

### confederacyHost

• **confederacyHost**: `string`

#### Defined in

[index.ts:11](https://github.com/p2ppsr/btms-core/blob/b9d8bb3/src/index.ts#L11)

___

### messageBox

• **messageBox**: `string`

#### Defined in

[index.ts:14](https://github.com/p2ppsr/btms-core/blob/b9d8bb3/src/index.ts#L14)

___

### peerServHost

• **peerServHost**: `string`

#### Defined in

[index.ts:12](https://github.com/p2ppsr/btms-core/blob/b9d8bb3/src/index.ts#L12)

___

### protocolID

• **protocolID**: `string`

#### Defined in

[index.ts:15](https://github.com/p2ppsr/btms-core/blob/b9d8bb3/src/index.ts#L15)

___

### satoshis

• **satoshis**: `number`

#### Defined in

[index.ts:18](https://github.com/p2ppsr/btms-core/blob/b9d8bb3/src/index.ts#L18)

___

### tokenator

• **tokenator**: `any`

#### Defined in

[index.ts:13](https://github.com/p2ppsr/btms-core/blob/b9d8bb3/src/index.ts#L13)

___

### topic

• **topic**: `string`

#### Defined in

[index.ts:17](https://github.com/p2ppsr/btms-core/blob/b9d8bb3/src/index.ts#L17)

## Methods

### acceptIncomingPayment

▸ **acceptIncomingPayment**(`assetId`, `txid`): `Promise`<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `assetId` | `string` |
| `txid` | `string` |

#### Returns

`Promise`<`boolean`\>

#### Defined in

[index.ts:241](https://github.com/p2ppsr/btms-core/blob/b9d8bb3/src/index.ts#L241)

___

### getBalance

▸ **getBalance**(`assetId`, `myTokens?`): `Promise`<`number`\>

Get the balance of a given asset.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `assetId` | `string` | The ID of the asset. |
| `myTokens?` | `any`[] | (Optional) An array of token objects owned by the caller. |

#### Returns

`Promise`<`number`\>

Returns a promise that resolves to the balance.

**`Async`**

#### Defined in

[index.ts:273](https://github.com/p2ppsr/btms-core/blob/b9d8bb3/src/index.ts#L273)

___

### getTokens

▸ **getTokens**(`assetId`, `includeEnvelope?`): `Promise`<`any`\>

Get all tokens for a given asset.

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `assetId` | `string` | `undefined` | The ID of the asset. |
| `includeEnvelope` | `boolean` | `true` | Include the envelope in the result. |

#### Returns

`Promise`<`any`\>

Returns a promise that resolves to an array of token objects.

**`Async`**

#### Defined in

[index.ts:258](https://github.com/p2ppsr/btms-core/blob/b9d8bb3/src/index.ts#L258)

___

### getTransactions

▸ **getTransactions**(`assetId`, `limit`, `offset`): `Promise`<`any`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `assetId` | `string` |
| `limit` | `number` |
| `offset` | `number` |

#### Returns

`Promise`<`any`[]\>

#### Defined in

[index.ts:289](https://github.com/p2ppsr/btms-core/blob/b9d8bb3/src/index.ts#L289)

___

### listAssets

▸ **listAssets**(): `Promise`<`any`[]\>

#### Returns

`Promise`<`any`[]\>

#### Defined in

[index.ts:52](https://github.com/p2ppsr/btms-core/blob/b9d8bb3/src/index.ts#L52)

___

### listIncomingPayments

▸ **listIncomingPayments**(`assetId`): `Promise`<`any`[]\>

List incoming payments for a given asset.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `assetId` | `string` | The ID of the asset. |

#### Returns

`Promise`<`any`[]\>

Returns a promise that resolves to an array of payment objects.

**`Async`**

#### Defined in

[index.ts:212](https://github.com/p2ppsr/btms-core/blob/b9d8bb3/src/index.ts#L212)

___

### proveOwnership

▸ **proveOwnership**(`assetId`, `amount`, `verifier`): `Promise`<`any`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `assetId` | `string` |
| `amount` | `number` |
| `verifier` | `string` |

#### Returns

`Promise`<`any`\>

#### Defined in

[index.ts:294](https://github.com/p2ppsr/btms-core/blob/b9d8bb3/src/index.ts#L294)

___

### refundIncomingTransaction

▸ **refundIncomingTransaction**(`assetId`, `txid`): `Promise`<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `assetId` | `string` |
| `txid` | `string` |

#### Returns

`Promise`<`boolean`\>

#### Defined in

[index.ts:246](https://github.com/p2ppsr/btms-core/blob/b9d8bb3/src/index.ts#L246)

___

### send

▸ **send**(`assetId`, `recipient`, `sendAmount`): `Promise`<`any`\>

Send tokens to a recipient.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `assetId` | `string` | The ID of the asset to be sent. |
| `recipient` | `string` | The recipient's public key. |
| `sendAmount` | `number` | The amount of the asset to be sent. |

#### Returns

`Promise`<`any`\>

Returns a promise that resolves to a transaction action object.

**`Async`**

**`Throws`**

Throws an error if the sender does not have enough tokens.

#### Defined in

[index.ts:66](https://github.com/p2ppsr/btms-core/blob/b9d8bb3/src/index.ts#L66)

___

### verifyOwnership

▸ **verifyOwnership**(`assetId`, `amount`, `prover`, `proof`): `Promise`<`boolean`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `assetId` | `string` |
| `amount` | `number` |
| `prover` | `string` |
| `proof` | `any` |

#### Returns

`Promise`<`boolean`\>

#### Defined in

[index.ts:299](https://github.com/p2ppsr/btms-core/blob/b9d8bb3/src/index.ts#L299)
