import {IGD} from './igd.ts'
import {SSDP} from './ssdp.ts'

interface UPnPOptions {
  description?: string
}

interface AddPortMappingOptions {
  remoteHostname?: string
  remotePort: number
  /**
   * @example '192.168.1.100'
   */
  localHostname?: string
  /**
   * @default localPort=remotePort
   */
  localPort?: number
  /**
   * @default 'tcp'
   */
  transport?: 'tcp' | 'udp'
  /**
   * @default ''
   */
  description?: string
  /**
   * @default true
   */
  enabled?: boolean
  /**
   * @default 0
   */
  leaseDuration?: number
}
interface DeletePortMappingOptions extends
  Pick<
    AddPortMappingOptions,
    'remoteHostname' | 'remotePort' | 'transport'
  >
{}

interface PortMappingResponse {
  service: string
  localHostname: string
  localPort: number
  remoteHostname: string | null
  remotePort: number | null
  transport: 'tcp' | 'udp'
  enabled: boolean
  description: string
  leaseDuration: number
}

export class UPnP {
  #ssdp: SSDP

  readonly options: UPnPOptions

  constructor(options: UPnPOptions = {}) {
    this.#ssdp = new SSDP()
    this.options = options
  }

  async getExternalIp() {
    const gateway = await this.#ssdp.search('urn:schemas-upnp-org:device:InternetGatewayDevice:1')
    const igd = new IGD(gateway.headers.get('location')!)

    try {
      const res = await igd.send('GetExternalIPAddress')
      return res['u:GetExternalIPAddressResponse'].NewExternalIPAddress
    } catch (e) {
      throw new Error('Failed to getExternalIp', {cause: e})
    }
  }

  async addPortMapping(options: AddPortMappingOptions) {
    const gateway = await this.#ssdp.search('urn:schemas-upnp-org:device:InternetGatewayDevice:1')
    const igd = new IGD(gateway.headers.get('location')!)

    options.transport ??= 'tcp'
    options.enabled ??= true
    options.description ??= this.options.description ?? ''
    options.localHostname ??= gateway.localAddress.hostname ?? ''

    return await igd.send('AddPortMapping', {
      NewRemoteHost: options?.remoteHostname ?? '',
      NewExternalPort: String(options.remotePort),
      NewProtocol: options.transport.toUpperCase() as 'TCP' | 'UDP',
      NewInternalPort: String(options.localPort ?? options.remotePort),
      NewInternalClient: options.localHostname ?? '',
      NewEnabled: Number(Boolean(options.enabled ?? true)),
      NewPortMappingDescription: options.description ?? '',
      NewLeaseDuration: String(options.leaseDuration),
    })
  }

  async deletePortMapping(options: DeletePortMappingOptions) {
    const gateway = await this.#ssdp.search('urn:schemas-upnp-org:device:InternetGatewayDevice:1')
    const igd = new IGD(gateway.headers.get('location')!)

    options.transport ??= 'tcp'
    options.remoteHostname ??= gateway.localAddress.hostname ?? ''

    try {
      await igd.send('DeletePortMapping', {
        NewRemoteHost: options?.remoteHostname,
        NewExternalPort: String(options.remotePort),
        NewProtocol: options.transport.toUpperCase() as 'TCP' | 'UDP',
      })
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === 'NoSuchEntryInArray') return
      }
      throw e
    }
  }

  async deletePortMappingAll(options?: {description?: string}) {
    for await (const {description, remotePort, transport} of this.#getPortMapping()) {
      if (description === (options?.description || this.options.description)) {
        await this.deletePortMapping({remotePort, transport})
      }
    }
  }

  async getPortMapping() {
    return Array.fromAsync(
      this.#getPortMapping(),
    )
  }

  async *#getPortMapping() {
    const gateway = await this.#ssdp.search('urn:schemas-upnp-org:device:InternetGatewayDevice:1')
    const igd = new IGD(gateway.headers.get('location')!)

    let i = 0
    try {
      while (true) {
        const payload = await igd.send('GetGenericPortMappingEntry', {NewPortMappingIndex: i++})

        if (payload['u:GetGenericPortMappingEntryResponse']) {
          const data = payload['u:GetGenericPortMappingEntryResponse']

          yield {
            service: data['@xmlns:u'],

            localHostname: data.NewInternalClient,
            localPort: Number(data.NewInternalPort),
            remoteHostname: data.NewRemoteHost,
            remotePort: Number(data.NewExternalPort),

            transport: data.NewProtocol.toLowerCase() as 'tcp' | 'udp',
            enabled: data.NewEnabled === '1',
            description: data.NewPortMappingDescription,
            leaseDuration: Number(data.NewLeaseDuration),
          } satisfies PortMappingResponse
        }
      }
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === 'SpecifiedArrayIndexInvalid') return // success
        console.error(e)
      }
    }
  }
}
