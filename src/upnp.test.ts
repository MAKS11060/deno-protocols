#!/usr/bin/env -S deno run -A --unstable-net --watch-hmr

import {IGD} from './igd.ts'
import {SSDP} from './ssdp.ts'
import {UPnP} from './upnp.ts'

// const ssdp = new SSDP()
// const gateway = await ssdp.search('urn:schemas-upnp-org:device:InternetGatewayDevice:1')

// const igd = new IGD(gateway.headers.get('location')!)

const upnp = new UPnP({description: 'test'})
console.log(await upnp.getExternalIp())
// console.log(await upnp.addPortMapping({remotePort: 8080, leaseDuration: 0}))
// console.log(await upnp.addPortMapping({remotePort: 8080, leaseDuration: 0, transport: 'udp'}))
// console.log(await upnp.deletePortMapping({remotePort: 8080}))
// console.log(await upnp.deletePortMappingAll())

console.log(await upnp.getPortMapping())
