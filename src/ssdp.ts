import {networkInterfaces, UDP} from '#runtime'
import {makeHttpRequest, parseHttpResponse} from './http.ts'

const SSDP_ADDR = '239.255.255.250'
const SSDP_PORT = 1900
const SSDP_MX = 3

type AnyString = string & {}
type SSDPSearch =
  | AnyString
  | 'ssdp:all'
  | 'upnp:rootdevice'
  // device
  | 'urn:schemas-upnp-org:device:[device-type]:[version]'
  | 'urn:schemas-upnp-org:device:InternetGatewayDevice:1'
  // service
  | 'urn:schemas-upnp-org:service:[service-type]:[version]'
  | 'urn:schemas-upnp-org:service:WANIPConnection:1'
  | 'urn:schemas-upnp-org:service:WANIPConnection:2'
  | 'urn:schemas-upnp-org:service:WANPPPConnection:1'
  | 'urn:schemas-upnp-org:service:ContentDirectory:1'

interface SSDPSearchOptions {
  /**
   * The maximum wait time in seconds (devices will delay their response randomly between 0 and MX seconds to avoid network flooding).
   *
   * @default 3
   */
  mx?: number
}

/** Simple Service Discovery Protocol */
export class SSDP {
  constructor() {}

  async search(searchTarget: SSDPSearch, options?: SSDPSearchOptions) {
    const message = makeHttpRequest({
      method: 'M-SEARCH',
      path: '*',
      httpVersion: 'HTTP/1.1',
      headers: {
        host: `${SSDP_ADDR}:${SSDP_PORT}`,
        man: '"ssdp:discover"',
        mx: `${options?.mx ?? SSDP_MX}`,
        st: `${searchTarget}`,
      },
    })

    const res = await Promise.race(
      networkInterfaces()
        .filter((int) => {
          if (!int.name.toLowerCase().startsWith('eth')) return
          if (int.family !== 'IPv4') return
          return true
        })
        .map(async (int) => {
          using conn = new UDP()
          await conn.bind({transport: 'udp', hostname: int.address, port: 0})

          await conn.send(message, {transport: 'udp', hostname: SSDP_ADDR, port: SSDP_PORT})

          const [data, addr] = await conn.receive()
          return {data, remoteAddr: addr, localAddress: conn.addr}
        }),
    )

    return {
      localAddress: res.localAddress as Deno.NetAddr & {transport: 'udp'},
      ...parseHttpResponse(res.data),
    }
  }
}
