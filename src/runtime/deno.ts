import type {Addr} from '../runtime/types.ts'

export const networkInterfaces = () => {
  return Deno.networkInterfaces()
}

export class UDP {
  socket!: Deno.DatagramConn
  constructor() {}

  get addr(): Addr {
    return this.socket.addr as Addr
  }

  bind(addr: Addr, options?: {
    reuseAddress?: boolean
    reusePort?: boolean
  }) {
    this.socket = Deno.listenDatagram({
      transport: 'udp',
      reuseAddress: options?.reuseAddress!,
      ...addr,
    })
  }

  async joinMulticastV4(address: string, networkInterfaces: string) {
    await this.socket.joinMulticastV4(address, networkInterfaces)
  }

  async send(data: Uint8Array<ArrayBuffer>, addr: Addr) {
    if (!this.socket) throw new Error('Socket is not binding')

    return await this.socket.send(data, addr)
  }

  async receive() {
    if (!this.socket) throw new Error('Socket is not binding')

    return await this.socket.receive()
  }

  [Symbol.dispose]() {
    this.socket.close()
  }
}
