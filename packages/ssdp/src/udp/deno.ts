import type {Addr} from './types.ts'

export class UDP {
  socket!: Deno.DatagramConn
  constructor() {}

  get addr(): Addr {
    return this.socket.addr as Addr
  }

  bind(addr: Addr) {
    this.socket = Deno.listenDatagram({...addr, transport: 'udp'})
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
    console.log('cloes')
    this.socket.close()
  }
}
