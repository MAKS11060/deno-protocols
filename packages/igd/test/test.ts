#!/usr/bin/env -S deno run -A --unstable-net --watch-hmr

import {SSDP} from '../../ssdp/src/mod.ts'
import {IGD} from '../src/mod.ts'

const ssdp = new SSDP()
const {headers} = await ssdp.search('urn:schemas-upnp-org:device:InternetGatewayDevice:1')
// console.log(headers)

const gatewayUrl = headers.get('location')!

const igd = new IGD(gatewayUrl)
// console.dir(await igd.getGateway(), {depth: null})
// console.log(await igd.getDevices())

console.log(await igd.getService('urn:schemas-upnp-org:service:WANIPConnection:1'))
