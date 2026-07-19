import {UDP} from '#runtime'
import {timingSafeEqual} from '@std/crypto/timing-safe-equal'

interface NetAddr {
  type: 'IPv4' | 'IPv6'
  hostname: string
  port: number
}

const StunMessageType = {
  // Class + Method
  BindingRequest: 0x00_01,
} as const

/* https://datatracker.ietf.org/doc/html/rfc5389#section-18.2 */
const StunAttributes = {
  MappedAddress: 0x0001,
  Username: 0x0006,
  MessageIntegrity: 0x0008,
  ErrorCode: 0x0009,
  UnknownAttributes: 0x000a,
  Realm: 0x0014,
  Nonce: 0x0015,
  XOR_MappedAddress: 0x0020,

  // Optional
  Software: 0x8022,
  alternateServer: 0x8023,
  Fingerprint: 0x8028,
} as const

const StunMessageTypeMappedAddress = {
  IPv4: 0x01,
  IPv6: 0x02,
} as const

const magic = Uint8Array.from([0x21, 0x12, 0xa4, 0x42])

const xor = (a: Uint8Array, b: Uint8Array) => a.map((v, i) => v ^ b[i]!)

export class STUN {
  readonly uri: URL

  constructor(options?: {
    /**
     * @example 'stun.l.google.com:19302'
     */
    uri?: string
  }) {
    this.uri = options?.uri?.startsWith('stun://')
      ? new URL(options.uri)
      : new URL(`stun://${options?.uri}`)
  }

  async #send(message: Uint8Array<ArrayBuffer>) {
    const udp = new UDP()
    await udp.bind({transport: 'udp', hostname: '0.0.0.0', port: 0})
    await udp.send(message, {transport: 'udp', hostname: this.uri.hostname, port: +this.uri.port})
    const [data, addr] = await udp.receive()

    return data
  }

  #createMessage(type: keyof typeof StunMessageType) {
    // const message = new Uint8Array(20 + 12 + 4 + 20)
    const message = new Uint8Array(20 + 12)
    const view = new DataView(message.buffer)
    const transactionId = crypto.getRandomValues(new Uint8Array(12))

    view.setUint16(0, StunMessageType[type])
    view.setUint16(2, 0) // Message Length
    view.setUint32(4, 0x2112a442) // Magic Cookie
    message.set(transactionId, 8)

    view.setUint16(2, message.length - 20)

    return {message, transactionId}
  }

  #parseAttr(data: Uint8Array) {
    let offset = 0
    return {
      *[Symbol.iterator]() {
        while (offset < data.length) {
          const view = new DataView(data.buffer, data.byteOffset + offset)
          const type = view.getUint16(0)
          const length = view.getUint16(2)
          const value = data.subarray(offset + 4, offset + 4 + length)
          yield {type, length, value}
          offset += 4 + length
        }
      },
    }
  }

  async getMappedAddress() {
    const {message, transactionId} = this.#createMessage('BindingRequest')
    const data = await this.#send(message)

    const view = new DataView(data.buffer)
    if (view.getUint16(0) !== 0x0101) {
      throw new Error('Invalid STUN response')
    }
    if (!timingSafeEqual(data.subarray(8, 20), transactionId)) {
      throw new Error('Invalid transaction ID in STUN response')
    }

    for (const attr of this.#parseAttr(data.subarray(20))) {
      if (attr.type === StunAttributes.XOR_MappedAddress) {
        const view = new DataView(attr.value.buffer)
        const type = view.getUint8(1)
        const port = attr.value.subarray(2, 4)
        const ip = attr.value.subarray(4, 8)
        const addr: NetAddr = {
          hostname: xor(ip, magic).join('.'),
          port: new DataView(xor(port, magic).buffer).getUint16(0),
          type: type === StunMessageTypeMappedAddress.IPv4 ? 'IPv4' : 'IPv6',
        }
        return addr
      }
    }
  }
}
