import pushdrop from 'pushdrop'
import { createAction, getTransactionOutputs, getPublicKey, submitDirectTransaction } from '@babbage/sdk'
import { Authrite } from 'authrite-js'
import Tokenator from '@babbage/tokenator'

/**
 * The BTMS class provides an interface for managing and transacting assets using the Babbage SDK.
 * @class
 */
export class BTMS {
  confederacyHost: string
  peerServHost: string
  tokenator: any
  messageBox: string
  protocolID: string
  basket: string
  topic: string
  satoshis: number

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
  constructor (
    confederacyHost = 'https://confederacy.babbage.systems',
    peerServHost = 'https://peerserv.babbage.systems',
    messageBox = 'TyPoints-Box',
    protocolID = 'tokens',
    basket = 'TyPoints2',
    topic = 'TyPoints',
    satoshis = 1000
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
  }

  async listAssets (): Promise<any[]> {
    // TODO: implement this method
    throw new Error('Not Implemented')
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
  async send(assetId: string, recipient: string, sendAmount: number): Promise<any> {
    const myTokens = await this.getTokens(assetId, true)
    const myBalance = await this.getBalance(assetId, myTokens)
    const myIdentityKey = await getPublicKey({ identityKey: true })

    // Make sure the amount is not more than what you have
    if (sendAmount > myBalance) {
      throw new Error('Not sufficient tokens.');
    }

    // Create redeem scripts for your tokens
    const inputs: any = {};
    for (const t of myTokens) {
      const unlockingScript = await pushdrop.redeem({
        prevTxId: t.txid,
        outputIndex: t.vout,
        lockingScript: t.outputScript,
        outputAmount: t.amount,
        protocolID: this.protocolID,
        keyID: '1',
        counterparty: t.customInstructions ? JSON.parse(JSON.parse(t.customInstructions)).sender : 'self'
      });
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
            unlockingScript
          }]
        }
      } else {
        inputs[t.txid].outputsToRedeem.push({
          index: t.vout,
          unlockingScript
        });
      }
    }

    // Create outputs for the recipient and your own change
    const outputs: any[] = [];
    const recipientScript = await pushdrop.create({
      fields: [
        String(sendAmount)
      ],
      protocolID: this.protocolID,
      keyID: '1',
      counterparty: recipient
    });
    outputs.push({
      script: recipientScript,
      satoshis: this.satoshis
    });
    let changeScript;
    if (myBalance - sendAmount > 0) {
      changeScript = await pushdrop.create({
        fields: [
          String(myBalance - sendAmount)
        ],
        protocolID: this.protocolID,
        keyID: '1',
        counterparty: 'self'
      });
      outputs.push({
        script: changeScript,
        basket: this.basket,
        satoshis: this.satoshis,
        customInstructions: JSON.stringify({
          sender: myIdentityKey
        })
      });
    }
    // Create the transaction
    const action = await createAction({
      description: `Send ${sendAmount} tokens to ${recipient}`,
      inputs,
      outputs
    });

    const tokenForRecipient = {
      txid: action.txid,
      vout: 0,
      amount: this.satoshis,
      envelope: {
        ...action
      },
      outputScript: recipientScript
    };

    // Send the transaction to the recipient
    await this.tokenator.sendMessage({
      recipient,
      messageBox: this.messageBox,
      body: JSON.stringify({
        token: tokenForRecipient
      })
    });

    // Process our own change outputs
    if (changeScript) {
      action.outputs = [{
        vout: 1,
        basket: this.basket,
        satoshis: this.satoshis,
        customInstructions: JSON.stringify({
          sender: myIdentityKey
        })
      }];
      await submitDirectTransaction({
        senderIdentityKey: myIdentityKey,
        note: 'Reclaim change',
        amount: this.satoshis,
        transaction: action
      });
      // TODO: This is useful if we are ever acting statefully in the future
      // Statefully as in storing this.myTokens and this.myBalances across
      // invocations, which would make things faster.
      // const tokenForChange = {
      //   txid: action.txid,
      //   vout: 1,
      //   amount: 1000,
      //   envelope: {
      //     ...action
      //   },
      //   outputScript: changeScript
      // };
      // Stateful this.myTokens.push(...)
    }

    return action
  }

  /**
   * List incoming payments for a given asset.
   * @async
   * @param {string} assetId - The ID of the asset.
   * @returns {Promise<any[]>} Returns a promise that resolves to an array of payment objects.
   */
  async listIncomingPayments (assetId: string): Promise<any[]> {
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
        const amount = Number(decodedToken.fields[0])
        payments.push({
          txid: token.txid,
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

  async acceptIncomingPayment (assetId: string, txid: string): Promise<boolean> {
    // TODO: implement this method
    throw new Error('Not Implemented')
  }

  async refundIncomingTransaction (assetId: string, txid: string): Promise<boolean> {
    // TODO: implement this method
    throw new Error('Not Implemented')
  }

   /**
   * Get all tokens for a given asset.
   * @async
   * @param {string} assetId - The ID of the asset.
   * @param {boolean} includeEnvelope - Include the envelope in the result.
   * @returns {Promise<any[]>} Returns a promise that resolves to an array of token objects.
   */
  async getTokens(assetId: string, includeEnvelope: boolean = true) {
    return await getTransactionOutputs({
      basket: this.basket,
      spendable: true,
      includeEnvelope
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
    if (myTokens === undefined) myTokens = [] // In my estimation this is completely unnecessary TypeScript bullshit. Please tell Ty how to make this go away.
    for (const x of myTokens) {
      const t = pushdrop.decode({
        script: x.outputScript,
        fieldFormat: 'utf8'
      })
      balance += Number(t.fields[0])
    }
    return balance
  }

  async getTransactions (assetId: string, limit: number, offset: number): Promise<any[]> {
    // TODO: implement this method
    throw new Error('Not Implemented')
  }

  async proveOwnership (assetId: string, amount: number, verifier: string): Promise<any> {
    // TODO: implement this method
    throw new Error('Not Implemented')
  }

  async verifyOwnership (assetId: string, amount: number, prover: string, proof: any): Promise<boolean> {
    // TODO: implement this method
    throw new Error('Not Implemented')
  }
}
