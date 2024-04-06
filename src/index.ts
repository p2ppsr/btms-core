import pushdrop from 'pushdrop'
import {
  createAction, getTransactionOutputs, getPublicKey, submitDirectTransaction,
  listActions, CreateActionResult, CreateActionOutput, CreateActionInput,
  GetTransactionOutputResult, revealKeyLinkage, SpecificKeyLinkageResult,
  decrypt as SDKDecrypt, EnvelopeApi
} from '@babbage/sdk-ts'
import { Authrite } from 'authrite-js'
import Tokenator from '@babbage/tokenator'
import { BigNumber, Curve, PrivateKey, PublicKey } from '@bsv/sdk'
import { getPaymentPrivateKey } from 'sendover'
import { decrypt as CWIDecrypt } from 'cwi-crypto'

const ANYONE = '0000000000000000000000000000000000000000000000000000000000000001'

export interface Asset {
  assetId: string
  balance: number
  name?: string
  iconURL?: string
  metadata?: string
  incoming?: boolean
  incomingAmount?: number
  new?: boolean
}

export interface TokenForRecipient {
  txid: string
  vout: number
  amount: number
  envelope: CreateActionResult
  keyID: string
  outputScript: string
}

export interface SubmitResult {
  status: 'auccess'
  topics: Record<string, number[]>
}

export interface OverlaySearchResult {
  inputs: string | null
  mapiResponses: string | null
  outputScript: string
  proof: string | null
  rawTx: string
  satoshis: number
  txid: string
  vout: number
}

export interface IncomingPayment {
  txid: string
  vout: number
  outputScript: string
  amount: number
  token: TokenForRecipient
  sender: string
  messageId: string
  keyID: string
  envelope: CreateActionResult
}

export interface OwnershipProof {
  prover: string
  verifier: string
  assetId: string
  amount: number
  tokens: {
    output: GetTransactionOutputResult
    linkage: SpecificKeyLinkageResult
  }[]
}

interface MarketplaceEntry {
  assetId: string
  amount: number
  seller: string
  description: string
  desiredAssets: Record<string, number>
  ownershipProof: OwnershipProof
  metadata: string
}

/**
 * Verify that the possibly undefined value currently has a value.
 */
function verifyTruthy<T>(v: T | null | undefined, description?: string): T {
  if (v == null) throw new Error(description ?? 'A truthy value is required.')
  return v
}

/**
 * The BTMS class provides an interface for managing and transacting assets using the Babbage SDK.
 * @class
 */
export class BTMS {
  confederacyHost: string
  peerServHost: string
  tokenator: Tokenator
  tokensMessageBox: string
  marketplaceMessageBox: string
  protocolID: string
  basket: string
  tokenTopic: string
  satoshis: number
  authrite: Authrite
  privateKey: string | undefined
  marketplaceTopic: string

  /**
   * BTMS constructor.
   * @constructor
   * @param {string} confederacyHost - The confederacy host URL.
   * @param {string} peerServHost - The peer service host URL.
   * @param {string} tokensMessageBox - The message box ID.
   * @param {string} protocolID - The protocol ID.
   * @param {string} basket - The asset basket ID.
   * @param {string} tokensTopic - The topic associated with the asset.
   * @param {number} satoshis - The number of satoshis involved in transactions.
   */
  constructor(
    confederacyHost = 'https://confederacy.babbage.systems',
    peerServHost = 'https://peerserv.babbage.systems',
    tokensMessageBox = 'tokens-box',
    protocolID = 'tokens',
    basket = 'tokens',
    tokensTopic = 'tokens',
    satoshis = 1000,
    privateKey?: string,
    marketplaceMessageBox = 'marketplace',
    marketplaceTopic = 'marketplace'
  ) {
    this.confederacyHost = confederacyHost
    this.peerServHost = peerServHost
    this.tokensMessageBox = tokensMessageBox
    this.protocolID = protocolID
    this.basket = basket
    this.tokenTopic = tokensTopic
    this.satoshis = satoshis
    const authriteParams: {
      clientPrivateKey?: string
    } = {}
    const tokenatorParams: {
      peerServHost: string,
      clientPrivateKey?: string
    } = { peerServHost }
    if (privateKey) {
      authriteParams.clientPrivateKey = privateKey
      tokenatorParams.clientPrivateKey = privateKey
    }
    this.tokenator = new Tokenator(tokenatorParams)
    this.authrite = new Authrite(authriteParams)
    this.privateKey = privateKey
    this.marketplaceMessageBox = marketplaceMessageBox
    this.marketplaceTopic = marketplaceTopic
  }

  async listAssets(): Promise<Asset[]> {
    const tokens = await getTransactionOutputs({ // TODO: signing strategy
      basket: this.basket,
      spendable: true,
      includeEnvelope: false
    })
    const assets: Record<string, Asset> = {}
    for (const token of tokens) {
      const decoded = pushdrop.decode({
        script: token.outputScript,
        fieldFormat: 'utf8'
      })
      let assetId = decoded.fields[0]
      if (assetId === 'ISSUE') {
        assetId = `${token.txid}.${token.vout}`
      }
      let parsedMetadata: { name: string } = { name: '' }
      try {
        parsedMetadata = JSON.parse(decoded.fields[2])
      } catch (_) { }
      if (!parsedMetadata.name) {
        continue
      }
      if (!assets[assetId]) {
        assets[assetId] = {
          ...parsedMetadata,
          balance: Number(decoded.fields[1]),
          metadata: decoded.fields[2],
          assetId
        }
      } else {
        assets[assetId].balance += Number(decoded.fields[1])
      }
    }

    // Now, we need to add in any incoming assets that we may have.
    const myIncomingMessages = await this.tokenator.listMessages({
      messageBox: this.tokensMessageBox
    })
    for (const message of myIncomingMessages) {
      let parsedBody, token
      try {
        parsedBody = JSON.parse(JSON.parse(message.body))
        token = parsedBody.token
        const decodedToken = pushdrop.decode({
          script: token.outputScript,
          fieldFormat: 'utf8'
        })
        let decodedAssetId: string = decodedToken.fields[0]
        if (decodedAssetId === 'ISSUE') {
          decodedAssetId = `${token.txid}.${token.vout}`
        }
        const amount = Number(decodedToken.fields[1])
        if (assets[decodedAssetId]) {
          assets[decodedAssetId].incoming = true
          if (!assets[decodedAssetId].incomingAmount) {
            assets[decodedAssetId].incomingAmount = amount
          } else {
            assets[decodedAssetId].incomingAmount = assets[decodedAssetId].incomingAmount as number + amount
          }
        } else {
          let parsedMetadata = {}
          try {
            parsedMetadata = JSON.parse(decodedToken.fields[2])
          } catch (_) {/* ignore */ }
          assets[decodedAssetId] = {
            assetId: decodedAssetId,
            ...parsedMetadata,
            new: true,
            incoming: true,
            incomingAmount: amount,
            balance: 0,
            metadata: decodedToken.fields[2]
          }
        }
      } catch (e) {
        console.error('Error parsing incoming message', e)
      }
    }

    return Object.values(assets)
  }

  async issue(amount: number, name: string): Promise<SubmitResult> {
    const keyID = this.getRandomKeyID()
    const tokenScript: string = await pushdrop.create({ // TODO: signing strategy
      fields: [
        'ISSUE',
        String(amount),
        JSON.stringify({ name })
      ],
      protocolID: this.protocolID,
      keyID
    })
    const action = await createAction({ // TODO: signing strategy
      description: `Issue ${amount} ${name} ${amount === 1 ? 'token' : 'tokens'}`,
      // labels: ??? // TODO: Label the issuance transaction with the issuance ID after it is created. Currently, issuance transactions do not show up.
      outputs: [{
        script: tokenScript,
        satoshis: this.satoshis,
        basket: this.basket,
        description: `${amount} new ${name}`,
        customInstructions: JSON.stringify({
          keyID
        })
      }]
    })
    return await this.submitToTokenOverlay(action)
  }

  /**
   * Send tokens to a recipient.
   * @async
   * @param {string} assetId - The ID of the asset to be sent.
   * @param {string} recipient - The recipient's public key.
   * @param {number} sendAmount - The amount of the asset to be sent.
   * @returns {Promise<any>} Returns a promise that resolves to a transaction action object.
   * @throws {Error} Throws an error if the sender does not have enough tokens.
   */
  async send(
    assetId: string,
    recipient: string,
    sendAmount: number,
    disablePeerServ = false,
    onPaymentSent = (payment: TokenForRecipient) => { }
  ): Promise<SubmitResult> {
    const myTokens = await this.getTokens(assetId, true)
    const myBalance = await this.getBalance(assetId, myTokens)
    // Make sure the amount is not more than what you have
    if (sendAmount > myBalance) {
      throw new Error('Not sufficient tokens.')
    }

    const myIdentityKey = await getPublicKey({ identityKey: true }) // TODO: signing strategy

    // We can decode the first token to extract the metadata needed in the outputs
    const { fields: [, , metadata] } = pushdrop.decode({
      script: myTokens[0].outputScript,
      fieldFormat: 'utf8'
    })
    let parsedMetadata: { name: string } = { name: 'Token' }
    try {
      parsedMetadata = JSON.parse(metadata)
    } catch (e) {/* ignore */ }

    // Create redeem scripts for your tokens
    const inputs: Record<string, CreateActionInput> = {}
    for (const t of myTokens) {
      const unlockingScript = await pushdrop.redeem({ // TODO: signing strategy
        prevTxId: t.txid,
        outputIndex: t.vout,
        lockingScript: t.outputScript,
        outputAmount: this.satoshis,
        protocolID: this.protocolID,
        keyID: this.getKeyIDFromInstructions(t.customInstructions),
        counterparty: this.getCounterpartyFromInstructions(t.customInstructions)
      })
      if (!inputs[t.txid]) {
        inputs[t.txid] = {
          ...t.envelope as EnvelopeApi,
          inputs: typeof t.envelope?.inputs === 'string'
            ? JSON.parse(t.envelope?.inputs)
            : t.envelope?.inputs,
          mapiResponses: typeof t.envelope?.mapiResponses === 'string'
            ? JSON.parse(t.envelope.mapiResponses)
            : t.envelope?.mapiResponses,
          proof: typeof t.envelope?.proof === 'string'
            ? JSON.parse(t.envelope?.proof)
            : t.envelope?.proof,
          outputsToRedeem: [{
            index: t.vout,
            spendingDescription: `Redeeming ${parsedMetadata.name}`,
            unlockingScript
          }]
        }
      } else {
        inputs[t.txid].outputsToRedeem.push({
          index: t.vout,
          unlockingScript,
          spendingDescription: `Redeeming ${parsedMetadata.name}`
        })
      }
    }

    // Create outputs for the recipient and your own change
    const outputs: CreateActionOutput[] = []
    const recipientKeyID = this.getRandomKeyID()
    const recipientScript: string = await pushdrop.create({ // TODO: signing strategy
      fields: [
        assetId,
        String(sendAmount),
        metadata
      ],
      protocolID: this.protocolID,
      keyID: recipientKeyID,
      counterparty: recipient
    })
    outputs.push({
      script: recipientScript,
      satoshis: this.satoshis,
      description: `Sending ${sendAmount} ${parsedMetadata.name}`,
      tags: [
        myIdentityKey === recipient ? 'owner self' : `owner ${recipient}`
      ]
    })
    if (myIdentityKey === recipient) {
      outputs[0].basket = this.basket
      outputs[0].customInstructions = JSON.stringify({
        sender: myIdentityKey,
        keyID: recipientKeyID
      })
    }
    let changeScript
    if (myBalance - sendAmount > 0) {
      const changeKeyID = this.getRandomKeyID()
      changeScript = await pushdrop.create({ // TODO: signing strategy
        fields: [
          assetId,
          String(myBalance - sendAmount),
          metadata
        ],
        protocolID: this.protocolID,
        keyID: changeKeyID,
        counterparty: 'self'
      })
      outputs.push({
        script: changeScript,
        basket: this.basket,
        satoshis: this.satoshis,
        description: `Keeping ${String(myBalance - sendAmount)} ${parsedMetadata.name}`,
        tags: ['owner self'],
        customInstructions: JSON.stringify({
          sender: myIdentityKey,
          keyID: changeKeyID
        })
      })
    }
    // Create the transaction
    const action = await createAction({ // TODO: signing strategy
      description: `Send ${sendAmount} ${parsedMetadata.name} to ${recipient}`,
      labels: [assetId.replace('.', ' ')],
      inputs,
      outputs
    })

    const tokenForRecipient: TokenForRecipient = {
      txid: action.txid,
      vout: 0,
      amount: this.satoshis,
      envelope: {
        ...action
      },
      keyID: recipientKeyID,
      outputScript: recipientScript
    }

    if (myIdentityKey !== recipient && !disablePeerServ) {
      // Send the transaction to the recipient
      await this.tokenator.sendMessage({
        recipient,
        messageBox: this.tokensMessageBox,
        body: JSON.stringify({
          token: tokenForRecipient
        })
      })
    }
    try {
      onPaymentSent(tokenForRecipient)
    } catch (e) { }

    return await this.submitToTokenOverlay(action)
  }

  /**
   * List incoming payments for a given asset.
   * @async
   * @param {string} assetId - The ID of the asset.
   * @returns {Promise<any[]>} Returns a promise that resolves to an array of payment objects.
   */
  async listIncomingPayments(assetId: string): Promise<IncomingPayment[]> {
    const myIncomingMessages = await this.tokenator.listMessages({
      messageBox: this.tokensMessageBox
    })
    const payments: IncomingPayment[] = []
    for (const message of myIncomingMessages) {
      let parsedBody, token: TokenForRecipient
      try {
        parsedBody = JSON.parse(JSON.parse(message.body))
        token = parsedBody.token
        const decodedToken = pushdrop.decode({
          script: token.outputScript,
          fieldFormat: 'utf8'
        })
        let decodedAssetId = decodedToken.fields[0]
        if (decodedAssetId === 'ISSUE') {
          decodedAssetId = `${token.txid}.${token.vout}`
        }
        if (assetId !== decodedAssetId) continue
        const amount = Number(decodedToken.fields[1])
        const newPayment = {
          ...token,
          txid: token.txid,
          vout: token.vout,
          outputScript: token.outputScript,
          amount,
          token,
          sender: message.sender,
          messageId: message.messageId,
          keyID: token.keyID
        }
        payments.push(newPayment)
      } catch (e) {
        console.error('Error parsing incoming message', e)
      }
    }
    return payments
  }

  async acceptIncomingPayment(assetId: string, payment: IncomingPayment): Promise<boolean> {
    // Verify the token is owned by the user
    const decodedToken = pushdrop.decode({
      script: payment.outputScript,
      fieldFormat: 'utf8'
    })
    let decodedAssetId = decodedToken.fields[0]
    if (decodedAssetId === 'ISSUE') {
      decodedAssetId = `${payment.txid}.${payment.vout}`
    }
    if (assetId !== decodedAssetId) {
      // Not something we can hope to fix, we acknowledge the message
      await this.tokenator.acknowledgeMessage({
        messageIds: [payment.messageId]
      })
      throw new Error(`This token is for the wrong asset ID. You are indicating you want to accept a token with asset ID ${assetId} but this token has assetId ${decodedAssetId}`)
    }
    const myKey = await getPublicKey({ // TODO: signing strategy
      protocolID: this.protocolID,
      keyID: payment.keyID || '1',
      counterparty: payment.sender,
      forSelf: true
    })
    if (myKey !== decodedToken.lockingPublicKey) {
      // Not something we can hope to fix, we acknowledge the message
      await this.tokenator.acknowledgeMessage({
        messageIds: [payment.messageId]
      })
      throw new Error('Received token not belonging to me!')
    }

    // Verify the token is on the overlay
    const verified = await this.findFromTokenOverlay(payment)
    if (verified.length < 1) {
      // Try to put it on the overlay
      try {
        await this.submitToTokenOverlay(payment)
      } catch (e) {
        console.error('ERROR RE-SUBMITTING IN ACCEPT', e)
      }

      // Check again
      const verifiedAfterSubmit = await this.findFromTokenOverlay(payment)
      // If still not there, we cannot proceed.
      if (verifiedAfterSubmit) {
        // Not something we can hope to fix, we acknowledge the message
        await this.tokenator.acknowledgeMessage({
          messageIds: [payment.messageId]
        })
        throw new Error('Token is for me but not on the overlay!')
      }
    }

    let parsedMetadata: { name: string } = { name: 'Token' }
    try {
      parsedMetadata = JSON.parse(decodedToken.fields[2])
    } catch (e) { }

    // Submit transaction
    await submitDirectTransaction({ // TODO: signing strategy
      senderIdentityKey: payment.sender,
      note: `Receive ${decodedToken.fields[1]} ${parsedMetadata.name} from ${payment.sender}`,
      amount: this.satoshis,
      labels: [assetId.replace('.', ' ')],
      transaction: {
        ...payment.envelope,
        outputs: [{
          vout: 0,
          basket: this.basket,
          satoshis: this.satoshis,
          tags: ['owner self'],
          customInstructions: JSON.stringify({
            sender: payment.sender,
            keyID: payment.keyID || '1'
          })
        }]
      }
    })

    if (payment.messageId) {
      await this.tokenator.acknowledgeMessage({
        messageIds: [payment.messageId]
      })
    }

    return true
  }

  async refundIncomingTransaction(assetId: string, payment: IncomingPayment): Promise<SubmitResult> {
    // We can decode the first token to extract the metadata needed in the outputs
    const { fields: [, , metadata] } = pushdrop.decode({
      script: payment.outputScript,
      fieldFormat: 'utf8'
    })

    // Create redeem scripts for your tokens
    const inputs: Record<string, CreateActionInput> = {}
    const unlockingScript = await pushdrop.redeem({ // TODO: signing strategy
      prevTxId: payment.txid,
      outputIndex: payment.vout,
      lockingScript: payment.outputScript,
      outputAmount: this.satoshis,
      protocolID: this.protocolID,
      keyID: payment.keyID || '1',
      counterparty: payment.sender
    })
    inputs[payment.txid] = {
      ...payment.envelope,
      inputs: typeof payment.envelope.inputs === 'string'
        ? JSON.parse(payment.envelope.inputs)
        : payment.envelope.inputs,
      mapiResponses: typeof payment.envelope.mapiResponses === 'string'
        ? JSON.parse(payment.envelope.mapiResponses)
        : payment.envelope.mapiResponses,
      // proof: typeof payment.envelope.proof === 'string' // no proof ever, right?
      //   ? JSON.parse(payment.envelope.proof)
      //   : payment.envelope.proof,
      outputsToRedeem: [{
        index: payment.vout,
        unlockingScript
      }]
    }

    // Create outputs for the recipient and your own change
    const outputs: CreateActionOutput[] = []
    const refundKeyID = this.getRandomKeyID()
    const recipientScript = await pushdrop.create({ // TODO: signing strategy
      fields: [
        assetId,
        String(payment.amount),
        metadata
      ],
      protocolID: this.protocolID,
      keyID: refundKeyID,
      counterparty: payment.sender
    })
    outputs.push({
      script: recipientScript,
      satoshis: this.satoshis
    })
    // Create the transaction
    const action = await createAction({ // TODO: signing strategy
      labels: [assetId.replace('.', ' ')],
      description: `Returning ${payment.amount} tokens to ${payment.sender}`,
      inputs,
      outputs
    })

    const tokenForRecipient: TokenForRecipient = {
      txid: action.txid,
      vout: 0,
      amount: this.satoshis,
      envelope: {
        ...action
      },
      keyID: refundKeyID,
      outputScript: recipientScript
    }

    // Send the transaction to the recipient
    await this.tokenator.sendMessage({
      recipient: payment.sender,
      messageBox: this.tokensMessageBox,
      body: JSON.stringify({
        token: tokenForRecipient
      })
    })

    if (payment.messageId) {
      await this.tokenator.acknowledgeMessage({
        messageIds: [payment.messageId]
      })
    }

    return await this.submitToTokenOverlay(action)
  }

  /**
   * Get all tokens for a given asset.
   * @async
   * @param {string} assetId - The ID of the asset.
   * @param {boolean} includeEnvelope - Include the envelope in the result.
   * @returns {Promise<any[]>} Returns a promise that resolves to an array of token objects.
   */
  async getTokens(assetId: string, includeEnvelope = true): Promise<GetTransactionOutputResult[]> {
    const tokens = await getTransactionOutputs({ // TODO: signing strategy
      basket: this.basket,
      spendable: true,
      includeEnvelope
    })
    return tokens.filter(x => {
      const decoded = pushdrop.decode({
        script: x.outputScript,
        fieldFormat: 'utf8'
      })
      let decodedAssetId = decoded.fields[0]
      if (decodedAssetId === 'ISSUE') {
        decodedAssetId = `${x.txid}.${x.vout}`
      }
      return decodedAssetId === assetId
    })
  }

  /**
   * Get the balance of a given asset.
   * @async
   * @param {string} assetId - The ID of the asset.
   * @param {any[]} myTokens - (Optional) An array of token objects owned by the caller.
   * @returns {Promise<number>} Returns a promise that resolves to the balance.
   */
  async getBalance(assetId: string, myTokens?: GetTransactionOutputResult[]): Promise<number> {
    if (!Array.isArray(myTokens)) {
      myTokens = await this.getTokens(assetId, false)
    }
    let balance = 0
    for (const x of myTokens) {
      const t = pushdrop.decode({
        script: x.outputScript,
        fieldFormat: 'utf8'
      })
      let tokenAssetId = t.fields[0]
      if (tokenAssetId === 'ISSUE') {
        tokenAssetId = `${x.txid}.${x.vout}`
      }
      if (tokenAssetId === assetId) {
        balance += Number(t.fields[1])
      }
    }
    return balance
  }

  async getTransactions(assetId: string, limit: number, offset: number): Promise<{
    transactions: {
      date: string,
      amount: number,
      txid: string,
      counterparty: string
    }[]
  }> {
    const actions = await listActions({ // TODO: signing strategy
      label: assetId.replace('.', ' '),
      limit,
      offset,
      addInputsAndOutputs: true,
      includeBasket: true,
      includeTags: true
    })
    const txs = actions.transactions.map(a => {
      let selfIn = 0
      let counterpartyIn = 'self'
      const inputs = verifyTruthy(a.inputs)
      for (let i = 0; i < inputs.length; i++) {
        const tags = verifyTruthy(inputs[i].tags)
        if (tags.some(x => x === 'owner self')) {
          const decoded = pushdrop.decode({
            script: Buffer.from(inputs[i].outputScript).toString('hex'),
            fieldFormat: 'utf8'
          })
          selfIn += Number(decoded.fields[1])
        } else {
          const ownerTag = tags.find(x => x.startsWith('owner '))
          if (ownerTag) {
            counterpartyIn = ownerTag.split(' ')[1]
          }
        }
      }
      let selfOut = 0
      let counterpartyOut = 'self'
      const outputs = verifyTruthy(a.outputs)
      for (let i = 0; i < outputs.length; i++) {
        const tags = verifyTruthy(outputs[i].tags)
        if (tags.some(x => x === 'owner self')) {
          const decoded = pushdrop.decode({
            script: Buffer.from(outputs[i].outputScript).toString('hex'),
            fieldFormat: 'utf8'
          })
          selfOut += Number(decoded.fields[1])
        } else {
          const ownerTag = tags.find(x => x.startsWith('owner '))
          if (ownerTag) {
            counterpartyOut = ownerTag.split(' ')[1]
          }
        }
      }
      const amount = selfOut - selfIn
      return {
        date: a.created_at,
        amount,
        txid: a.txid,
        counterparty: amount < 0 ? counterpartyOut : counterpartyIn
      }
    })
    return {
      ...actions,
      transactions: txs
    }
  }

  async proveOwnership(assetId: string, amount: number, verifier: string): Promise<OwnershipProof> {
    // Get a list of tokens
    const myTokens = await this.getTokens(assetId, true)
    let amountProven = 0
    const provenTokens: {
      output: GetTransactionOutputResult;
      linkage: SpecificKeyLinkageResult;
    }[] = []
    const myIdentityKey = await getPublicKey({ identityKey: true })
    // Go through the list
    for (const token of myTokens) {
      // Obtain key linkage for each token
      const parsedInstructions = JSON.parse(token.customInstructions as string)
      const linkage = await revealKeyLinkage({ // TODO: signing strategy
        mode: 'specific',
        counterparty: this.getCounterpartyFromInstructions(parsedInstructions),
        protocolID: this.protocolID,
        keyID: this.getKeyIDFromInstructions(parsedInstructions),
        verifier,
        description: 'Prove token ownership'
      })
      provenTokens.push({
        output: token,
        linkage: linkage as SpecificKeyLinkageResult
      })
      // Increment the amount counter each time
      const t = pushdrop.decode({
        script: token.outputScript,
        fieldFormat: 'utf8'
      })
      amountProven += Number(t.fields[1])
      // Break if the amount counter goes above the amount to prove
      if (amountProven > amount) break
    }
    // After the loop check the counter
    // Error if we have not proven the full amount
    if (amountProven < amount) {
      throw new Error('User does not have amount of asset requested for ownership oroof.')
    }
    // Return the proof
    return {
      prover: myIdentityKey,
      verifier,
      tokens: provenTokens,
      amount,
      assetId
    }
  }

  async verifyOwnership(proof: OwnershipProof, useAnyoneKey = false): Promise<boolean> {
    // Keep count of amount proven
    let amountProven = 0
    // Go through all tokens
    for (const token of proof.tokens) {
      // Increment the amount counter each time
      const t = pushdrop.decode({
        script: token.output.outputScript,
        fieldFormat: 'utf8'
      })
      amountProven += Number(t.fields[1])
      // Ensure token linkage is verified for prover
      const valid = await this.verifyLinkageForProver(token.linkage, t.lockingPublicKey, useAnyoneKey)
      if (!valid) {
        throw new Error('Invalid key linkage for token prover.')
      }
      // Ensure the proof belongs to the prover
      if (token.linkage.prover !== proof.prover) {
        throw new Error('Prover tried to prove tokens that were not theirs.')
      }
      // Ensure token is on overlay
      const resultFromOverlay = await this.findFromTokenOverlay({
        txid: token.output.txid,
        vout: token.output.vout
      })
      if (resultFromOverlay.length < 1) {
        throw new Error('Claimed token is not on the overlay.')
      }
    }
    // Check amount in proof against total
    // Error if amounts mismatch
    if (amountProven !== proof.amount) {
      throw new Error('Amount of tokens in proof not as claimed.')
    }
    // Return true as proof is valid
    return true
  }

  /**
   * Checks that an asset ID is in the correct format
   * @param assetId Asset ID to validate
   * @returns a boolean indicating asset ID validity
   */
  validateAssetId(assetId: string): boolean {
    if (typeof assetId !== 'string') {
      return false
    }
    const [first, second, third] = assetId.split('.')
    if (typeof first !== 'string' || typeof second !== 'string') {
      return false
    }
    if (typeof third !== 'undefined') {
      return false
    }
    if (!/^[0-9a-fA-F]{64}$/.test(first)) {
      return false
    }
    const secondNum = Number(second)
    if (!Number.isInteger(secondNum)) {
      return false
    }
    if (secondNum < 0) {
      return false
    }
    return true
  }

  /**
   * Lists an asset on the marketplace for sale
   * @param assetId The ID of the asset to list
   * @param amount The amount you want to sell
   * @param desiredAssets Assets you would desire to have in return so people can make you an offer
   * @param description Marketplace listing description
   * @returns Overlay network submission results
   */
  async listAssetForSale(
    assetId: string,
    amount: number,
    desiredAssets: Record<string, number>,
    description?: string
  ): Promise<SubmitResult> {
    // Validate desired assets
    for (const key of Object.keys(desiredAssets)) {
      const validAssetId = this.validateAssetId(key)
      if (!validAssetId) {
        const e = new Error('Assset ID in desired assets structure invalid')
        console.error('Rejecting output for having an invalid asset ID in desired assets')
        throw e
      }
    }
    for (const val of Object.values(desiredAssets)) {
      if (typeof val !== 'number' || val < -1 || !Number.isInteger(val)) {
        const e = new Error('Amount in desired assets structure invalid')
        console.error('Rejecting output for having an invalid amount in desired assets')
        throw e
      }
    }

    // Creat a proof
    const anyonePub = new PrivateKey(ANYONE, 'hex').toPublicKey().toString()
    const proof = await this.proveOwnership(assetId, amount, anyonePub)
    // Compose a PushDrop token
    const token = await pushdrop.create({
      fields: [
        Buffer.from(JSON.stringify(proof), 'utf8'),
        Buffer.from(JSON.stringify(desiredAssets), 'utf8'),
        Buffer.from(description || '', 'utf8')
      ],
      protocolID: 'marketplace',
      keyID: '1',
      counterparty: anyonePub,
      ownedByCreator: true
    })
    // Create a transaction
    const action = await createAction({
      description: 'List assets on the marketplace',
      outputs: [{
        satoshis: this.satoshis,
        script: token
      }]
    })
    // Send the transaction to the oerlay
    return await this.submitToMarketplaceOverlay(action)
  }

  /**
   * Returns an array of all marketplace entries
   * @returns An array of all marketplace entries
   */
  async findAllAssetsForSale(): Promise<MarketplaceEntry[]> {
    const assets = await this.findFromMarketplaceOverlay({ findAll: true })
    const results: MarketplaceEntry[] = []
    for (const asset of assets) {
      const decoded = pushdrop.decode({
        script: asset.outputScript,
        returnType: 'buffer'
      })
      const parsedProof: OwnershipProof = JSON.parse(decoded.fields[0].toString('utf8'))
      const parsedDesiredAssets = JSON.parse(decoded.fields[1].toString('utf8'))
      const decodedAsset = pushdrop.redeem({
        script: parsedProof.tokens[0].output.outputScript,
        returnType: 'utf8'
      })
      results.push({
        seller: parsedProof.prover,
        amount: parsedProof.amount,
        description: decoded.fields[2] ? decoded.fields[2].toString('utf8') : '',
        desiredAssets: parsedDesiredAssets,
        ownershipProof: parsedProof,
        assetId: parsedProof.assetId,
        metadata: decodedAsset.fields[2].toString('utf8')
      })
    }
    return results
  }

  async makeOffer(entry: MarketplaceEntry, assetId: string, amount: number): Promise<void> {
    // Verify the assets are still available
    const verified = await this.verifyOwnership(entry.ownershipProof, true)
    if (!verified) {
      throw new Error('Item is no longer for sale.')
    }
    // Compose a proof of our assets for the seller
    const buyerProof = await this.proveOwnership(assetId, amount, entry.seller)
    const decodedBuyerAsset = pushdrop.redeem({
      script: buyerProof.tokens[0].output.outputScript,
      returnType: 'utf8'
    })
    const metadata = decodedBuyerAsset.fields[2].toString('utf8')
    // Create a conditionally signed transaction paying the seller's assets to us
    const desiredBuyerKeyID = this.getRandomKeyID()
    const desiredBuyerScript = await pushdrop.create({
      fields: [
        Buffer.from(entry.assetId, 'utf8'),
        Buffer.from(String(entry.amount), 'utf8'),
        Buffer.from(entry.metadata, 'utf8')
      ],
      protocolID: this.protocolID,
      keyID: desiredBuyerKeyID,
      counterparty: entry.seller,
      ownedByCreator: true
    })
    const desiredSellerKeyID = this.getRandomKeyID()
    const desiredSellerScript = await pushdrop.create({
      fields: [
        Buffer.from(assetId, 'utf8'),
        Buffer.from(String(amount), 'utf8'),
        Buffer.from(metadata, 'utf8')
      ],
      protocolID: this.protocolID,
      keyID: desiredSellerKeyID,
      counterparty: entry.seller,
      ownedByCreator: false
    })
    // TODO: Go through all seller inputs and add them to the list
    // TODO: Go through all buyer inputs and sign them conditionally
    const outputs = [{
      script: desiredBuyerScript,
      satoshis: this.satoshis
    }, {
      script: desiredSellerScript,
      satoshis: this.satoshis
    }] // TODO: Buyer and seller may both want change. Currently this is not implemented.
    const templateToSign = await createAction({
      inputs: {},
      outputs,
      description: 'Propose an asset exchange'
    })

    // Send the proof to the seller
  }

  private async verifyLinkageForProver(linkage: SpecificKeyLinkageResult, expectedKey: string, useAnyoneKey = false): Promise<boolean> {
    // Decrypt the linkage
    let decryptedLinkage: Uint8Array
    if (this.privateKey || useAnyoneKey) {
      // derive the decryption key
      const derivedKey = getPaymentPrivateKey({
        recipientPrivateKey: useAnyoneKey ? ANYONE : this.privateKey,
        senderPublicKey: linkage.prover,
        invoiceNumber: `${linkage.protocolID[0]}-${linkage.protocolID[1]}-${(linkage as unknown as { keyID: string }).keyID}`,
        returnType: 'hex'
      })
      const derivedCryptoKey = await crypto.subtle.importKey(
        'raw',
        Uint8Array.from(Buffer.from(derivedKey, 'hex')),
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      )
      // decrypt the value
      decryptedLinkage = CWIDecrypt(linkage.encryptedLinkage, derivedCryptoKey, 'string')
      console.log('Decrypted linkage', decryptedLinkage)
    } else {
      decryptedLinkage = await SDKDecrypt({
        ciphertext: linkage.encryptedLinkage,
        counterparty: linkage.prover,
        protocolID: [2, `specific linkage revelation ${linkage.protocolID[0]} ${linkage.protocolID[1]}`],
        keyID: (linkage as unknown as { keyID: string }).keyID, // !!! ERRPR im base type, it DOES have keyID
        returnType: 'Uint8Array'
      }) as Uint8Array
    }
    // Add it to the prover's identity key with point addition
    const curve = new Curve()
    const linkagePoint = curve.g.mul(
      new BigNumber([...new Uint8Array(decryptedLinkage as Uint8Array)])
    )
    const identityKey = PublicKey.fromString(linkage.prover)
    const actualDerivedPoint = identityKey.add(linkagePoint)
    const actualDerivedKey = new PublicKey(actualDerivedPoint).toString()
    // Check the result against the expected key
    if (expectedKey === actualDerivedKey) {
      return true
    }
    return false
  }

  private async findFromTokenOverlay(token: { txid: string, vout: number }): Promise<OverlaySearchResult[]> {
    const result = await this.authrite.request(`${this.confederacyHost}/lookup`, {
      method: 'post',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        provider: 'tokens',
        query: {
          txid: token.txid,
          vout: token.vout
        }
      })
    })

    const json = await result.json()
    return json
  }

  private async findFromMarketplaceOverlay(token: {
    txid?: string,
    vout?: number,
    findAll?: boolean,
    assetId?: string,
    seller?: string
  }): Promise<OverlaySearchResult[]> {
    const result = await this.authrite.request(`${this.confederacyHost}/lookup`, {
      method: 'post',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        provider: 'marketplace',
        query: token
      })
    })

    const json = await result.json()
    return json
  }

  private async submitToTokenOverlay(tx, topics = [this.tokenTopic]): Promise<SubmitResult> {
    const result = await this.authrite.request(`${this.confederacyHost}/submit`, {
      method: 'post',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...tx,
        topics
      })
    })
    const json = await result.json()
    console.log('submit to overlay', json)
    return json
  }

  private async submitToMarketplaceOverlay(tx, topics = [this.marketplaceTopic]): Promise<SubmitResult> {
    const result = await this.authrite.request(`${this.confederacyHost}/submit`, {
      method: 'post',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...tx,
        topics
      })
    })
    const json = await result.json()
    console.log('submit to overlay', json)
    return json
  }

  private getCounterpartyFromInstructions(i): string {
    if (!i) {
      return 'self'
    }
    while (typeof i === 'string') {
      i = JSON.parse(i)
    }
    return i.sender
  }

  private getKeyIDFromInstructions(i): string {
    if (!i) {
      return '1'
    }
    while (typeof i === 'string') {
      i = JSON.parse(i)
    }
    return i.keyID || '1'
  }

  private getRandomKeyID(): string {
    // eslint-disable-next-line
    return require('crypto').randomBytes(32).toString('base64')
  }
}
