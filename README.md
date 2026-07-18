# ts-net

Implementation clients for:

- [IGN (Internet Gateway Device)](#ign)
- [SSDP (Simple Service Discovery Protocol)](#ssdp)
- [UPnP (Universal Plug and Play)](#upnp)
- [STUN (Session Traversal Utilities for NAT)](#stun)

### Runtime

- [x] Deno
- [ ] Node - WIP

## IGN

```ts
const ssdp = new SSDP()
const {headers} = await ssdp.search('urn:schemas-upnp-org:device:InternetGatewayDevice:1')
const gatewayUrl = headers.get('location')!

const igd = new IGD(gatewayUrl)
console.log(await igd.getDevices())
```

## SSDP

```ts
const ssdp = new SSDP()

const {headers} = await ssdp.search('ssdp:all')
console.log(headers)
```

## UPnP

```ts
const upnp = new UPnP({description: 'test-service'})

console.log(await upnp.getExternalIp())

await upnp.addPortMapping({remotePort: 8080, leaseDuration: 60})
await upnp.addPortMapping({remotePort: 8080, leaseDuration: 60, transport: 'udp'})
console.log(await upnp.getPortMapping())

await upnp.deletePortMapping({remotePort: 8080})
await upnp.deletePortMappingAll()
console.log(await upnp.getPortMapping())
```

## STUN

```ts
const stun = new STUN({uri: 'stun.l.google.com:19302'})

console.log(await stun.getMappedAddress())
```
