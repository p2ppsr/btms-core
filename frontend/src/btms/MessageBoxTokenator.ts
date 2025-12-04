/**
 * MessageBoxTokenator
 *
 * A wrapper around MessageBoxClient that provides a simplified interface
 * for BTMS token messaging operations.
 */

import { WalletInterface } from '@bsv/sdk'
import { MessageBoxClient } from '@bsv/message-box-client'

const DEFAULT_MESSAGEBOX_HOST = 'https://messagebox.babbage.systems'

/** Debug flag - set to true for verbose logging */
let DEBUG_ENABLED = false

/** Debug logger function */
let debugLogger: (label: string, ...rest: unknown[]) => void = () => { }

/**
 * Configure debug logging for MessageBoxTokenator.
 */
export function configureTokenatorDebug(
  enabled: boolean,
  logger: (label: string, ...rest: unknown[]) => void
): void {
  DEBUG_ENABLED = enabled
  debugLogger = logger
}

/**
 * MessageBoxTokenator provides a simplified interface for BTMS token messaging.
 *
 * It wraps the MessageBoxClient and handles initialization, message sending,
 * listing, and acknowledgment operations.
 */
export class MessageBoxTokenator {
  private walletClient: WalletInterface
  private defaultBox: string
  private host: string
  private client: MessageBoxClient | null = null
  private initPromise: Promise<MessageBoxClient> | null = null

  constructor(
    walletClient: WalletInterface,
    defaultBox: string,
    host = DEFAULT_MESSAGEBOX_HOST
  ) {
    this.walletClient = walletClient
    this.defaultBox = defaultBox
    this.host = host
  }

  // --------------------------
  // Type guards
  // --------------------------
  private static isUint8Array(x: unknown): x is Uint8Array {
    return x instanceof Uint8Array
  }

  private static isNumberArray(x: unknown): x is number[] {
    return Array.isArray(x) && x.every(n => typeof n === 'number')
  }

  private static safeParseJSON(str: string): unknown | null {
    try {
      return JSON.parse(str)
    } catch {
      return null
    }
  }

  // ---------------------------------------------------------
  // Ensure underlying MessageBoxClient is initialized
  // ---------------------------------------------------------
  private async ensureClient(): Promise<MessageBoxClient> {
    if (this.client) return this.client

    if (!this.initPromise) {
      if (DEBUG_ENABLED) {
        debugLogger('MessageBoxTokenator: creating MessageBoxClient…', {
          host: this.host,
          box: this.defaultBox
        })
      }

      const net = await this.walletClient.getNetwork({})
      const networkPreset = net?.network ?? 'mainnet'

      this.initPromise = (async () => {
        const client = new MessageBoxClient({
          host: this.host,
          walletClient: this.walletClient,
          enableLogging: DEBUG_ENABLED,
          networkPreset
        })

        await client.init()

        if (DEBUG_ENABLED) {
          debugLogger('MessageBoxTokenator: client.init() done')
        }

        this.client = client
        return client
      })()
    }

    return this.initPromise
  }

  // ---------------------------------------------------------
  // Explicit init that BTMS can await
  // ---------------------------------------------------------
  async init(): Promise<void> {
    if (DEBUG_ENABLED) {
      debugLogger('MessageBoxTokenator.init(): ensuring MessageBoxClient is ready', {
        defaultBox: this.defaultBox
      })
    }

    await this.ensureClient()
  }

  // -------------------------------------------------------
  // Send a message to a recipient
  // -------------------------------------------------------
  async sendMessage(args: {
    recipient: string
    messageBox?: string
    body: string
  }): Promise<void> {
    const client = await this.ensureClient()
    const { recipient, messageBox, body } = args
    const box = messageBox ?? this.defaultBox

    const payload: string = body
    const bodyObj = MessageBoxTokenator.safeParseJSON(body)

    let beefLen: number | null = null

    if (bodyObj && typeof bodyObj === 'object') {
      const maybeBeef =
        (bodyObj as { beef?: unknown }).beef ??
        (bodyObj as { token?: { beef?: unknown } }).token?.beef

      if (MessageBoxTokenator.isNumberArray(maybeBeef)) beefLen = maybeBeef.length
      if (MessageBoxTokenator.isUint8Array(maybeBeef)) beefLen = maybeBeef.length
    }

    if (DEBUG_ENABLED) {
      debugLogger('MessageBoxTokenator.sendMessage ->', {
        recipient,
        box,
        bodyPreview: payload.slice(0, 160),
        beefLen
      })
    }

    const t0 = Date.now()

    try {
      const resp = await client.sendMessage({
        recipient,
        messageBox: box,
        body: payload
      })

      if (DEBUG_ENABLED) {
        debugLogger('[MessageBoxTokenator] sendMessage OK', {
          ms: Date.now() - t0,
          hasResp: !!resp,
          status: resp.status,
          id: resp.messageId,
          beefLen
        })
      }
    } catch (e) {
      const err = e as Error
      if (DEBUG_ENABLED) {
        debugLogger('[MessageBoxTokenator] sendMessage ERROR', {
          ms: Date.now() - t0,
          message: err.message,
          stackTop: (err.stack ?? '').split('\n').slice(0, 3).join(' | ')
        })
      }
      throw err
    }
  }

  // -------------------------------------------------------
  // List messages from a message box
  // -------------------------------------------------------
  async listMessages(args: { messageBox?: string }) {
    const client = await this.ensureClient()
    const box = args.messageBox ?? this.defaultBox
    return client.listMessages({ messageBox: box })
  }

  // -------------------------------------------------------
  // Acknowledge a single message (delegates to acknowledgeMessages)
  // -------------------------------------------------------
  async acknowledgeMessage(args: { messageIds: string[] }): Promise<void> {
    return this.acknowledgeMessages(args)
  }

  // -------------------------------------------------------
  // Acknowledge multiple messages
  // -------------------------------------------------------
  async acknowledgeMessages(args: { messageIds: string[] }): Promise<void> {
    const client = await this.ensureClient()
    if (!args.messageIds.length) return

    await client.acknowledgeMessage({ messageIds: args.messageIds })
  }
}
