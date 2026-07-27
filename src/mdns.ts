import {Addr} from './runtime/types.ts'

const MDNS_MULTICAST_GROUP = '224.0.0.251'
const MDNS_MULTICAST_GROUP_V6 = 'ff02::fb'
const MDNS_PORT = 5353

const QType = {
  A: 1,
  PTR: 12,
  TXT: 16,
  SRV: 33,
  ANY: 255,
} as const

interface DNSQuestion {
  name: string
  qtype: number
  qclass: number
}

interface DNSRecord {
  name: string
  rtype: number
  rclass: number
  ttl: number
  rdata: Uint8Array
  ip?: string
}

const encoder = new TextEncoder()

const concat = (buffers: readonly Uint8Array[]): Uint8Array<ArrayBuffer> => {
  let length = 0
  for (const buffer of buffers) length += buffer.length
  const output = new Uint8Array(length)
  let index = 0
  for (const buffer of buffers) {
    output.set(buffer, index)
    index += buffer.length
  }

  return output
}

export const encodeDomainName = (domain: string): Uint8Array<ArrayBuffer> => {
  let chunks: Uint8Array<ArrayBuffer>[] = []

  // string to: len + payload
  for (const part of domain.split('.')) {
    if (!part.length) continue
    const partBuf = encoder.encode(part) // test
    chunks.push(new Uint8Array([partBuf.byteLength]), partBuf) // 'test'.length + 'data'
  }

  chunks.push(new Uint8Array([0x00])) // end

  return concat(chunks)
}

export const decodeDomainName = (buffer: Uint8Array, offset: {value: number}): string => {
  const parts: string[] = []
  const decoder = new TextDecoder()

  while (offset.value < buffer.length) {
    const len = buffer[offset.value]!

    if ((len & 0xc0) === 0xc0) {
      offset.value += 2
      parts.push('local')
      return parts.join('.')
    }

    offset.value += 1
    if (len === 0) break

    const partBytes = buffer.slice(offset.value, offset.value + len)
    parts.push(decoder.decode(partBytes))
    offset.value += len
  }

  return parts.join('.')
}

export class mDNS {
  localRecords: Map<string, string> = new Map()
  listener!: Deno.DatagramConn

  async start() {
    const listener = Deno.listenDatagram({
      transport: 'udp',
      hostname: '0.0.0.0',
      // hostname: '192.168.100.2',
      // hostname: '[::]',
      // hostname: '::',
      port: MDNS_PORT,
      reuseAddress: true,
    })
    this.listener = listener

    const m = await listener.joinMulticastV4(MDNS_MULTICAST_GROUP, '192.168.100.2')
    m.setLoopback(true)
    // const m6 = await listener.joinMulticastV6('ff02::fb', 0)
    // m6.setLoopback(true)

    for await (const [data, from] of listener) {
      // console.log({data, from})
      this.handlePacket(data, from as Addr)
    }
  }

  async query(name: string, qtype: typeof QType[keyof typeof QType] = QType.A) {
    if (!this.listener) throw new Error('Listener not binding')

    // header
    const header = new Uint8Array(12)
    const headerView = new DataView(header.buffer)
    headerView.setUint16(0, 0) // ID
    headerView.setUint16(2, 0x0000) // Flags
    headerView.setUint16(4, 1) // QDCOUNT
    headerView.setUint16(6, 0) // ANCOUNT
    headerView.setUint16(8, 0) // NSCOUNT
    headerView.setUint16(10, 0) // ARCOUNT

    // domain
    const domain = encodeDomainName(name)

    //
    const questionTail = new Uint8Array(4)
    const questionTailView = new DataView(questionTail.buffer)
    questionTailView.setUint16(0, qtype) // QTYPE
    questionTailView.setUint16(2, 1) // QCLASS: IN

    //
    // const packet = new Uint8Array(header.byteLength + domain.byteLength + questionTail.byteLength)
    const packet = concat([header, domain, questionTail])

    console.log('send')
    await this.listener.send(packet, {
      transport: 'udp',
      hostname: MDNS_MULTICAST_GROUP,
      // hostname: MDNS_MULTICAST_GROUP_V6,
      port: MDNS_PORT,
    })
    console.log('send ok')
  }

  private handlePacket(data: Uint8Array<ArrayBuffer>, remoteAddr: Addr) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)

    const flags = view.getUint16(2)
    const qdCount = view.getUint16(4)
    const anCount = view.getUint16(6)

    const isResponse = (flags & 0x8000) !== 0
    const offset = {value: 12} // skip header 12

    if (!isResponse) {
      // --- (Inbound Query) ---
      for (let i = 0; i < qdCount; i++) {
        const name = decodeDomainName(data, offset)
        const qtype = view.getUint16(offset.value)
        offset.value += 2
        const qclass = view.getUint16(offset.value)
        offset.value += 2

        this.processIncomingQuery({name, qtype, qclass}, remoteAddr)
      }
    } else {
      // --- (Inbound Response) ---
      // Skip questions section
      for (let i = 0; i < qdCount; i++) {
        decodeDomainName(data, offset)
        offset.value += 4
      }

      // Parse answers
      for (let i = 0; i < anCount; i++) {
        const name = decodeDomainName(data, offset)
        const rtype = view.getUint16(offset.value)
        offset.value += 2
        const rclass = view.getUint16(offset.value)
        offset.value += 2
        const ttl = view.getUint32(offset.value)
        offset.value += 4
        const rdLength = view.getUint16(offset.value)
        offset.value += 2

        const rdata = data.slice(offset.value, offset.value + rdLength)
        offset.value += rdLength

        let ip!: string
        if (rtype === QType.A && rdLength === 4) {
          ip = Array.from(rdata).join('.')
        }

        this.processIncomingResponse({name, rtype, rclass, ttl, rdata, ip}, remoteAddr)
      }
    }
  }

  async processIncomingQuery(query: DNSQuestion, remoteAddr: Addr) {
    console.log('processIncomingQuery', query)
    if (this.localRecords.has(query.name) && (query.qtype === QType.A || query.qtype === QType.ANY)) {
      const targetIp = this.localRecords.get(query.name)!
      console.log(`[mDNS] Request to (${query.name}) from ${remoteAddr.hostname}. Response..`)

      const header = new Uint8Array(12)
      const view = new DataView(header.buffer)
      view.setUint16(0, 0) // ID
      view.setUint16(2, 0x8400) // Flags: Response + Authoritative
      view.setUint16(4, 0) // QDCOUNT
      view.setUint16(6, 1) // ANCOUNT: 1 answer
      view.setUint16(8, 0)
      view.setUint16(10, 0)

      const encodedName = encodeDomainName(query.name)

      const recordTail = new Uint8Array(10)
      const tailView = new DataView(recordTail.buffer)
      tailView.setUint16(0, QType.A) // RTYPE: A
      tailView.setUint16(2, 1) // RCLASS: IN
      tailView.setUint32(4, 120) // TTL: 120 sec
      tailView.setUint16(8, 4) // RDLENGTH: 4 byte for IPv4

      const ipBytes = new Uint8Array(targetIp.split('.').map(Number))

      // packet
      const packet = concat([header, encodedName, recordTail, ipBytes])

      // send response to multicast
      await this.listener?.send(packet, {
        transport: 'udp',
        hostname: MDNS_MULTICAST_GROUP,
        // hostname: MDNS_MULTICAST_GROUP_V6,
        port: MDNS_PORT,
      })
    }
  }

  private processIncomingResponse(record: DNSRecord, remoteAddr: Addr) {
    if (record.rtype === QType.A && record.ip) {
      console.log(`[mDNS] [Device detected] ${record.name} -> IP: ${record.ip} (from ${remoteAddr.hostname})`)
    }
  }
}
