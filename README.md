# btms-core

Tools for creating and managing UTXO-based tokens

## Installation

    npm i btms-core

## Example Usage

```ts
// todo
```

## Documentation

<!--#region ts2md-api-merged-here-->

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

### Interfaces

| |
| --- |
| [Asset](#interface-asset) |
| [IncomingPayment](#interface-incomingpayment) |
| [OverlaySearchResult](#interface-overlaysearchresult) |
| [OwnershipProof](#interface-ownershipproof) |
| [SubmitResult](#interface-submitresult) |
| [TokenForRecipient](#interface-tokenforrecipient) |

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

---

#### Interface: Asset

```ts
export interface Asset {
    assetId: string;
    balance: number;
    name?: string;
    iconURL?: string;
    metadata?: string;
    incoming?: boolean;
    incomingAmount?: number;
    new?: boolean;
}
```

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

---
#### Interface: TokenForRecipient

```ts
export interface TokenForRecipient {
    txid: string;
    vout: number;
    amount: number;
    envelope: CreateActionResult;
    keyID: string;
    outputScript: string;
}
```

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

---
#### Interface: SubmitResult

```ts
export interface SubmitResult {
    status: "auccess";
    topics: Record<string, number[]>;
}
```

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

---
#### Interface: OverlaySearchResult

```ts
export interface OverlaySearchResult {
    inputs: string | null;
    mapiResponses: string | null;
    outputScript: string;
    proof: string | null;
    rawTx: string;
    satoshis: number;
    txid: string;
    vout: number;
}
```

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

---
#### Interface: IncomingPayment

```ts
export interface IncomingPayment {
    txid: string;
    vout: number;
    outputScript: string;
    amount: number;
    token: TokenForRecipient;
    sender: string;
    messageId: string;
    keyID: string;
    envelope: CreateActionResult;
}
```

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

---
#### Interface: OwnershipProof

```ts
export interface OwnershipProof {
    prover: string;
    verifier: string;
    assetId: string;
    amount: number;
    tokens: {
        output: GetTransactionOutputResult;
        linkage: SpecificKeyLinkageResult;
    }[];
}
```

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

---
### Classes

#### Class: BTMS

The BTMS class provides an interface for managing and transacting assets using the Babbage SDK.

```ts
export class BTMS {
    confederacyHost: string;
    peerServHost: string;
    tokenator: Tokenator;
    messageBox: string;
    protocolID: string;
    basket: string;
    topic: string;
    satoshis: number;
    authrite: Authrite;
    constructor(confederacyHost = "https://confederacy.babbage.systems", peerServHost = "https://peerserv.babbage.systems", messageBox = "tokens-box", protocolID = "tokens", basket = "tokens", topic = "tokens", satoshis = 1000) 
    async listAssets(): Promise<Asset[]> 
    async issue(amount: number, name: string): Promise<SubmitResult> 
    async send(assetId: string, recipient: string, sendAmount: number, disablePeerServ = false, onPaymentSent = (payment: TokenForRecipient) => { }): Promise<SubmitResult> 
    async listIncomingPayments(assetId: string): Promise<IncomingPayment[]> 
    async acceptIncomingPayment(assetId: string, payment: IncomingPayment): Promise<boolean> 
    async refundIncomingTransaction(assetId: string, payment: IncomingPayment): Promise<SubmitResult> 
    async getTokens(assetId: string, includeEnvelope = true): Promise<GetTransactionOutputResult[]> 
    async getBalance(assetId: string, myTokens?: GetTransactionOutputResult[]): Promise<number> 
    async getTransactions(assetId: string, limit: number, offset: number): Promise<{
        transactions: {
            date: string;
            amount: number;
            txid: string;
            counterparty: string;
        }[];
    }> 
    async proveOwnership(assetId: string, amount: number, verifier: string): Promise<OwnershipProof> 
    async verifyOwnership(proof: OwnershipProof): Promise<boolean> 
}
```

<details>

<summary>Class BTMS Details</summary>

##### Constructor

BTMS constructor.

```ts
constructor(confederacyHost = "https://confederacy.babbage.systems", peerServHost = "https://peerserv.babbage.systems", messageBox = "tokens-box", protocolID = "tokens", basket = "tokens", topic = "tokens", satoshis = 1000) 
```

Argument Details

+ **confederacyHost**
  + The confederacy host URL.
+ **peerServHost**
  + The peer service host URL.
+ **messageBox**
  + The message box ID.
+ **protocolID**
  + The protocol ID.
+ **basket**
  + The asset basket ID.
+ **topic**
  + The topic associated with the asset.
+ **satoshis**
  + The number of satoshis involved in transactions.

##### Method getBalance

Get the balance of a given asset.

```ts
async getBalance(assetId: string, myTokens?: GetTransactionOutputResult[]): Promise<number> 
```

Returns

Returns a promise that resolves to the balance.

Argument Details

+ **assetId**
  + The ID of the asset.
+ **myTokens**
  + (Optional) An array of token objects owned by the caller.

##### Method getTokens

Get all tokens for a given asset.

```ts
async getTokens(assetId: string, includeEnvelope = true): Promise<GetTransactionOutputResult[]> 
```

Returns

Returns a promise that resolves to an array of token objects.

Argument Details

+ **assetId**
  + The ID of the asset.
+ **includeEnvelope**
  + Include the envelope in the result.

##### Method listIncomingPayments

List incoming payments for a given asset.

```ts
async listIncomingPayments(assetId: string): Promise<IncomingPayment[]> 
```

Returns

Returns a promise that resolves to an array of payment objects.

Argument Details

+ **assetId**
  + The ID of the asset.

##### Method send

Send tokens to a recipient.

```ts
async send(assetId: string, recipient: string, sendAmount: number, disablePeerServ = false, onPaymentSent = (payment: TokenForRecipient) => { }): Promise<SubmitResult> 
```

Returns

Returns a promise that resolves to a transaction action object.

Argument Details

+ **assetId**
  + The ID of the asset to be sent.
+ **recipient**
  + The recipient's public key.
+ **sendAmount**
  + The amount of the asset to be sent.

Throws

Throws an error if the sender does not have enough tokens.

</details>

Links: [API](#api), [Interfaces](#interfaces), [Classes](#classes)

---

<!--#endregion ts2md-api-merged-here-->

## License

The license for the code in this repository is the Open BSV License.
