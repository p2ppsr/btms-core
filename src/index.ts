import pushdrop from 'pushdrop'
import { createAction, getTransactionOutputs, getPublicKey, submitDirectTransaction, listActions } from '@babbage/sdk'
import { Authrite } from 'authrite-js'
import Tokenator from '@babbage/tokenator'

/**
 * The BTMS class provides an interface for managing and transacting assets using the Babbage SDK.
 * @class
 */
export class BTMS {
  confederacyHost: string
  peerServHost: string
  tokenator: Tokenator
  messageBox: string
  protocolID: string
  basket: string
  topic: string
  satoshis: number
  authrite: Authrite

  /**
   * BTMS constructor.
   * @constructor
   * @param {string} confederacyHost - The confederacy host URL.
   * @param {string} peerServHost - The peer service host URL.
   * @param {string} messageBox - The message box ID.
   * @param {string} protocolID - The protocol ID.
   * @param {string} basket - The asset basket ID.
   * @param {string} topic - The topic associated with the asset.
   * @param {number} satoshis - The number of satoshis involved in transactions.
   */
  constructor(
    confederacyHost = 'https://confederacy.babbage.systems',
    peerServHost = 'https://peerserv.babbage.systems',
    messageBox = 'tokens-box',
    protocolID = 'tokens',
    basket = 'tokens',
    topic = 'tokens',
    satoshis = 1000,
  ) {
    this.confederacyHost = confederacyHost
    this.peerServHost = peerServHost
    this.messageBox = messageBox
    this.protocolID = protocolID
    this.basket = basket
    this.topic = topic
    this.satoshis = satoshis
    this.tokenator = new Tokenator({
      peerServHost
    })
    this.authrite = new Authrite()
  }

  async listAssets(): Promise<any[]> {
    const tokens = await getTransactionOutputs({
      basket: this.basket,
      spendable: true,
      includeEnvelope: false
    })
    const assets = {}
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
          metadata: decoded.fields[2]
        }
      } else {
        assets[assetId].balance += Number(decoded.fields[1])
      }
    }

    // Now, we need to add in any incoming assets that we may have.
    const myIncomingMessages = await this.tokenator.listMessages({
      messageBox: this.messageBox
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
        let decodedAssetId = decodedToken.fields[0]
        if (decodedAssetId === 'ISSUE') {
          decodedAssetId = `${token.txid}.${token.vout}`
        }
        const amount = Number(decodedToken.fields[1])
        if (assets[decodedAssetId]) {
          assets[decodedAssetId].incoming = true
          if (!assets[decodedAssetId].incomingAmount) {
            assets[decodedAssetId].incomingAmount = amount
          } else {
            assets[decodedAssetId].incomingAmount += amount
          }
        } else {
          let parsedMetadata = {}
          try {
            parsedMetadata = JSON.parse(decodedToken.fields[2])
          } catch (_) { }
          assets[decodedAssetId] = {
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

    return Object.entries(assets).map(([a, o]) => ({ ...o!, assetId: a }))
  }

  async issue(amount: number, name: string) {
    const tokenScript = await pushdrop.create({
      fields: [
        'ISSUE',
        String(amount),
        JSON.stringify({ name })
      ],
      protocolID: this.protocolID,
      keyID: '1'
    })
    const action = await createAction({
      description: `Issue ${amount} ${name} ${amount === 1 ? 'token' : 'tokens'}`,
      // labels: ??? // TODO: Label the issuance transaction with the issuance ID after it is created. Currently, issuance transactions do not show up.
      outputs: [{
        script: tokenScript,
        satoshis: this.satoshis,
        basket: this.basket,
        description: `${amount} new ${name}`
      }]
    })
    return await this.submitToOverlay(action)
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
  async send(assetId: string, recipient: string, sendAmount: number, disablePeerServ = false, onPaymentSent = (payment: any) => { }): Promise<any> {
    const myTokens = await this.getTokens(assetId, true)
    const myBalance = await this.getBalance(assetId, myTokens)
    const myIdentityKey = await getPublicKey({ identityKey: true })

    // Make sure the amount is not more than what you have
    if (sendAmount > myBalance) {
      throw new Error('Not sufficient tokens.')
    }

    // We can decode the first token to extract the metadata needed in the outputs
    const { fields: [, , metadata] } = pushdrop.decode({
      script: myTokens[0].outputScript,
      fieldFormat: 'utf8'
    })
    let parsedMetadata: { name: String } = { name: 'Token' }
    try {
      parsedMetadata = JSON.parse(metadata)
    } catch (e) { }

    // Create redeem scripts for your tokens
    const inputs: any = {}
    for (const t of myTokens) {
      const unlockingScript = await pushdrop.redeem({
        prevTxId: t.txid,
        outputIndex: t.vout,
        lockingScript: t.outputScript,
        outputAmount: this.satoshis,
        protocolID: this.protocolID,
        keyID: '1',
        counterparty: this.getCounterpartyFromInstructions(t.customInstructions)
      })
      if (!inputs[t.txid]) {
        inputs[t.txid] = {
          ...t.envelope,
          inputs: typeof t.envelope.inputs === 'string'
            ? JSON.parse(t.envelope.inputs)
            : t.envelope.inputs,
          mapiResponses: typeof t.envelope.mapiResponses === 'string'
            ? JSON.parse(t.envelope.mapiResponses)
            : t.envelope.mapiResponses,
          proof: typeof t.envelope.proof === 'string'
            ? JSON.parse(t.envelope.proof)
            : t.envelope.proof,
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
    const outputs: any[] = []
    const recipientScript = await pushdrop.create({
      fields: [
        assetId,
        String(sendAmount),
        metadata
      ],
      protocolID: this.protocolID,
      keyID: '1',
      counterparty: recipient
    })
    outputs.push({
      script: recipientScript,
      satoshis: this.satoshis,
      description: `Sending ${sendAmount} ${parsedMetadata.name}`
    })
    if (myIdentityKey === recipient) {
      outputs[0].basket = this.basket
      outputs[0].customInstructions = JSON.stringify({
        sender: myIdentityKey
      })
    }
    let changeScript
    if (myBalance - sendAmount > 0) {
      changeScript = await pushdrop.create({
        fields: [
          assetId,
          String(myBalance - sendAmount),
          metadata
        ],
        protocolID: this.protocolID,
        keyID: '1',
        counterparty: 'self'
      })
      outputs.push({
        script: changeScript,
        basket: this.basket,
        satoshis: this.satoshis,
        description: `Keeping ${String(myBalance - sendAmount)} ${parsedMetadata.name}`,
        customInstructions: JSON.stringify({
          sender: myIdentityKey
        })
      })
    }
    // Create the transaction
    const action = await createAction({
      description: `Send ${sendAmount} ${parsedMetadata.name} to ${recipient}`,
      labels: [assetId.replace('.', ' ')],
      inputs,
      outputs
    })

    const tokenForRecipient = {
      txid: action.txid,
      vout: 0,
      amount: this.satoshis,
      envelope: {
        ...action
      },
      outputScript: recipientScript
    }

    if (myIdentityKey !== recipient && !disablePeerServ) {
      // Send the transaction to the recipient
      await this.tokenator.sendMessage({
        recipient,
        messageBox: this.messageBox,
        body: JSON.stringify({
          token: tokenForRecipient
        })
      })
    }
    try {
      onPaymentSent(tokenForRecipient)
    } catch (e) { }

    return await this.submitToOverlay(action)
  }

  /**
   * List incoming payments for a given asset.
   * @async
   * @param {string} assetId - The ID of the asset.
   * @returns {Promise<any[]>} Returns a promise that resolves to an array of payment objects.
   */
  async listIncomingPayments(assetId: string): Promise<any[]> {
    const myIncomingMessages = await this.tokenator.listMessages({
      messageBox: this.messageBox
    })
    const payments: any[] = []
    for (const message of myIncomingMessages) {
      let parsedBody, token
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
        payments.push({
          ...token,
          txid: token.txid,
          vout: token.vout,
          outputScript: token.outputScript,
          amount,
          token,
          sender: message.sender,
          messageId: message.messageId
        })
      } catch (e) {
        console.error('Error parsing incoming message', e)
      }
    }
    return payments
  }

  async acceptIncomingPayment(assetId: string, payment: any): Promise<boolean> {
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
      throw new Error('This token is for the wrong asset ID. You are indicating you want to accept a token with asset ID ${assetId} but this token has assetId ${decodedAssetId}')
    }
    const myKey = await getPublicKey({
      protocolID: this.protocolID,
      keyID: '1',
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
    const verified = await this.findFromOverlay(payment)
    if (verified.length < 1) {
      // Try to put it on the overlay
      try {
        await this.submitToOverlay(payment)
      } catch (e) {
        console.error('ERROR RE-SUBMITTING IN ACCEPT', e)
      }

      // Check again
      const verifiedAfterSubmit = await this.findFromOverlay(payment)
      // If still not there, we cannot proceed.
      if (verifiedAfterSubmit) {
        // Not something we can hope to fix, we acknowledge the message
        await this.tokenator.acknowledgeMessage({
          messageIds: [payment.messageId]
        })
        throw new Error('Token is for me but not on the overlay!')
      }
    }

    let parsedMetadata: { name: String } = { name: 'Token' }
    try {
      parsedMetadata = JSON.parse(decodedToken.fields[2])
    } catch (e) { }

    // Submit transaction
    await submitDirectTransaction({
      senderIdentityKey: payment.sender,
      note: `Receive ${decodedToken.fields[1]} ${parsedMetadata.name} from ${payment.sender}`,
      amount: this.satoshis,
      transaction: {
        ...payment.envelope,
        labels: [assetId.replace('.', ' ')],
        outputs: [{
          vout: 0,
          basket: this.basket,
          satoshis: this.satoshis,
          customInstructions: JSON.stringify({
            sender: payment.sender
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

  async refundIncomingTransaction(assetId: string, payment: any): Promise<boolean> {
    // We can decode the first token to extract the metadata needed in the outputs
    const { fields: [, , metadata] } = pushdrop.decode({
      script: payment.outputScript,
      fieldFormat: 'utf8'
    })

    // Create redeem scripts for your tokens
    const inputs: any = {}
    const unlockingScript = await pushdrop.redeem({
      prevTxId: payment.txid,
      outputIndex: payment.vout,
      lockingScript: payment.outputScript,
      outputAmount: this.satoshis,
      protocolID: this.protocolID,
      keyID: '1',
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
      proof: typeof payment.envelope.proof === 'string'
        ? JSON.parse(payment.envelope.proof)
        : payment.envelope.proof,
      outputsToRedeem: [{
        index: payment.vout,
        unlockingScript
      }]
    }

    // Create outputs for the recipient and your own change
    const outputs: any[] = []
    const recipientScript = await pushdrop.create({
      fields: [
        assetId,
        String(payment.amount),
        metadata
      ],
      protocolID: this.protocolID,
      keyID: '1',
      counterparty: payment.sender
    })
    outputs.push({
      script: recipientScript,
      satoshis: this.satoshis
    })
    // Create the transaction
    const action = await createAction({
      labels: [assetId.replace('.', ' ')],
      description: `Returning ${payment.amount} tokens to ${payment.sender}`,
      inputs,
      outputs
    })

    const tokenForRecipient = {
      txid: action.txid,
      vout: 0,
      amount: this.satoshis,
      envelope: {
        ...action
      },
      outputScript: recipientScript
    }

    // Send the transaction to the recipient
    await this.tokenator.sendMessage({
      recipient: payment.sender,
      messageBox: this.messageBox,
      body: JSON.stringify({
        token: tokenForRecipient
      })
    })

    if (payment.messageId) {
      await this.tokenator.acknowledgeMessage({
        messageIds: [payment.messageId]
      })
    }

    return await this.submitToOverlay(action)
  }

  /**
   * Get all tokens for a given asset.
   * @async
   * @param {string} assetId - The ID of the asset.
   * @param {boolean} includeEnvelope - Include the envelope in the result.
   * @returns {Promise<any[]>} Returns a promise that resolves to an array of token objects.
   */
  async getTokens(assetId: string, includeEnvelope: boolean = true) {
    const tokens = await getTransactionOutputs({
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
  async getBalance(assetId: string, myTokens?: any[]): Promise<number> {
    if (!Array.isArray(myTokens)) {
      myTokens = await this.getTokens(assetId, false)
    }
    let balance = 0
    for (const x of myTokens!) {
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

  async getTransactions(assetId: string, limit: number, offset: number): Promise<any[]> {
    const actions = await listActions({
      label: assetId.replace('.', ' '),
      limit,
      offset
    })
    if (Array.isArray(actions.transactions)) {
      actions.transactions = actions.transactions.map(a => {
        console.log(a) // TODO: parse this
        return a
      })
    }
    return actions
  }

  async proveOwnership(assetId: string, amount: number, verifier: string): Promise<any> {
    // Make use of new proveKeyLinkage Babbage SDK function
    // TODO: implement this method
    throw new Error('Not Implemented')
  }

  async verifyOwnership(assetId: string, amount: number, prover: string, proof: any): Promise<boolean> {
    // TODO: implement this method
    throw new Error('Not Implemented')
  }

  private async findFromOverlay(token: { txid: string, vout: number }): Promise<any> {
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

    return await result.json()
  }

  private async submitToOverlay(tx, topics = [this.topic]) {
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
    return await result.json()
  }

  private getCounterpartyFromInstructions(i) {
    if (!i) {
      return 'self'
    }
    while (typeof i === 'string') {
      i = JSON.parse(i)
    }
    return i.sender
  }
}
