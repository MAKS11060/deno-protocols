import {createSocket, type RemoteInfo, type Socket} from 'node:dgram'
import type {Addr} from './types.ts'

export class UDP {
  socket: Socket
  addr!: Addr

  constructor() {
    this.socket = createSocket('udp4')
  }

  async bind({port, hostname: address}: Addr) {
    await new Promise<void>((r) => {
      this.socket.bind({port, address}, () => r())
    })
    {
      const {address, port} = this.socket.address()
      this.addr = {hostname: address, port, transport: 'udp'} as Addr
    }
    return
  }

  async send(data: Uint8Array<ArrayBuffer>, addr: Addr) {
    return await new Promise<number>((resolve, reject) => {
      this.socket.send(data, addr.port, addr.hostname, (e, bytes) => {
        if (e) return reject(e)
        resolve(bytes)
      })
    })
  }

  async receive() {
    const {promise, resolve} = Promise.withResolvers<[Buffer, RemoteInfo]>()
    this.socket.once('message', (...args) => resolve(args))
    const [data, addr] = await promise
    return [new Uint8Array(data), addr] as const
  }

  [Symbol.dispose]() {
    this.socket.close()
  }
}
