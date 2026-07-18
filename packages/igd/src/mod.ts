import * as XML from '@libs/xml'

// #region types
interface RawService {
  serviceType: string
  serviceId: string
  SCPDURL: string
  controlURL: string
  eventSubURL: string
}

interface RawDevice {
  deviceType: string
  friendlyName: string
  UDN: string
  serviceList?: {service: RawService | RawService[]}
  deviceList?: {device: RawDevice | RawDevice[]}
  [key: string]: any // Для остальных полей (modelName, serialNumber и т.д.)
}

// 2. Описываем типы для плоского (выходного) формата
export interface FlatDevice {
  nodeType: 'device'
  deviceType: string
  friendlyName: string
  UDN: string
  serialNumber?: string
}

export interface FlatService {
  nodeType: 'service'
  serviceType: string
  serviceId: string
  controlURL: string
  SCPDURL: string
  eventSubURL: string
  parentUDN: string
}

export type FlatUPnPNode = FlatDevice | FlatService
// #endregion

// #region helper
const ensureArray = <T>(obj: T | T[] | undefined): T[] => {
  if (!obj) return []
  return Array.isArray(obj) ? obj : [obj]
}

export function* walkUPnP(device: RawDevice, parentUDN?: string): Generator<FlatUPnPNode, void, unknown> {
  const currentUDN = device.UDN

  yield {
    nodeType: 'device',
    deviceType: device.deviceType,
    friendlyName: device.friendlyName,
    UDN: currentUDN,
    serialNumber: device.serialNumber,
  }

  if (device.serviceList?.service) {
    const services = ensureArray(device.serviceList.service)
    for (const s of services) {
      yield {
        nodeType: 'service',
        serviceType: s.serviceType,
        serviceId: s.serviceId,
        controlURL: s.controlURL,
        SCPDURL: s.SCPDURL,
        eventSubURL: s.eventSubURL,
        parentUDN: currentUDN,
      }
    }
  }

  if (device.deviceList?.device) {
    const subDevices = ensureArray(device.deviceList.device)
    for (const subDevice of subDevices) {
      yield* walkUPnP(subDevice, currentUDN)
    }
  }
}
// #endregion

type AnyString = string & {}
type ServiceType =
  | AnyString
  | 'urn:schemas-upnp-org:service:WANIPConnection:1'
  | 'urn:schemas-upnp-org:service:WANIPConnection:2'
  | 'urn:schemas-upnp-org:service:WANPPPConnection:1'

// type Action =
//   | AnyString
//   | 'GetExternalIPAddress'
//   | 'AddPortMapping'
//   | 'DeletePortMapping'

interface SendActionMap {
  GetExternalIPAddress: {
    args: void
    data: {
      'u:GetExternalIPAddressResponse': {
        '@xmlns:u': string
        NewExternalIPAddress: string
      }
    }
  }
  AddPortMapping: {
    args: {
      NewRemoteHost: string
      NewExternalPort: string
      NewProtocol: 'TCP' | 'UDP'
      NewInternalPort?: string
      NewInternalClient?: string
      NewEnabled: 0 | 1 | number
      NewPortMappingDescription?: string
      NewLeaseDuration?: string
    }
    data: {
      'u:AddPortMappingResponse': {'@xmlns:u': 'urn:schemas-upnp-org:service:WANIPConnection:1'}
    }
  }
  DeletePortMapping: {
    args: {
      NewRemoteHost: string
      NewExternalPort: string
      NewProtocol: 'TCP' | 'UDP'
    }
    data: unknown
  }
  GetGenericPortMappingEntry: {
    args: {
      NewPortMappingIndex: number
    }
    data: {
      'u:GetGenericPortMappingEntryResponse': {
        '@xmlns:u': string
        NewRemoteHost: string | null
        NewExternalPort: string
        NewProtocol: 'TCP' | 'UDP'
        NewInternalPort: string
        NewInternalClient: string
        NewEnabled: string
        NewPortMappingDescription: string
        NewLeaseDuration: string
      }
    }
  }
}

/** Internet Gateway Device */
export class IGD {
  readonly gatewayUri: string
  constructor(gatewayUri: string) {
    this.gatewayUri = gatewayUri
  }

  async getGateway() {
    const res = await fetch(this.gatewayUri)
    if (!res.ok) throw new Error('Failed to get Gateway device')
    const text = await res.text()
    return XML.parse(text)
  }

  async getDevices() {
    const xml = await this.getGateway()
    if (!xml.root) return

    const root = xml.root as {device: RawDevice}
    const device = root.device

    return walkUPnP(device).toArray()
  }

  async getService(service?: ServiceType | ServiceType[]) {
    const device = await this.getDevices()
    return device
      ?.filter((v) => v.nodeType === 'service')
      .find((v) => Array.isArray(service) ? service.includes(v.serviceType) : v.serviceType === service)
  }

  async getServiceWANIP() {
    const services = [
      'urn:schemas-upnp-org:service:WANIPConnection:1',
      'urn:schemas-upnp-org:service:WANIPConnection:2',
      'urn:schemas-upnp-org:service:WANPPPConnection:1',
    ]

    const res = await this.getService(services)
    if (!res) throw new Error('WANIPConnection service not found')

    return res
  }

  async send<A extends keyof SendActionMap>(
    action: A,
    args?: SendActionMap[A]['args'],
  ): Promise<SendActionMap[A]['data']>
  async send(action: string, args?: Record<string, unknown>) {
    const service = await this.getServiceWANIP()

    const url = new URL(service.controlURL, this.gatewayUri)
    const body = XML.stringify({
      '@version': '1.0',
      '@encoding': 'utf-8',
      's:Envelope': {
        '@xmlns:s': 'http://schemas.xmlsoap.org/soap/envelope/',
        '@s:encodingStyle': 'http://schemas.xmlsoap.org/soap/encoding/',
        's:Body': {
          [`u:${action}`]: {
            '@xmlns:u': service.serviceType,
            ...args,
          },
        },
      },
    })

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': `text/xml; charset="utf-8"`,
        SOAPAction: JSON.stringify(`${service.serviceType}#${action}`),
      },
      body,
    })
    const text = await res.text()
    const xml = XML.parse(text)

    if (res.status !== 200) {
      const data = xml['s:Envelope'] as XML.XmlNode
      const body = data['s:Body'] as XML.XmlNode
      const {faultstring, detail} = body['s:Fault'] as any
      const {errorCode, errorDescription} = detail[faultstring] as XML.XmlNode
      throw new Error(`${errorDescription}`, {
        cause: `${faultstring} - ${errorCode}`,
      })
    }

    const data = xml['s:Envelope'] as XML.XmlNode
    return {
      ...(data['s:Body'] as XML.XmlNode),
    } as Record<string, unknown>
  }
}
