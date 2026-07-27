#!/usr/bin/env -S deno run -A --unstable-net --watch

import {networkInterfaces, UDP} from '#runtime'
import {mDNS} from './mdns.ts'

const int = networkInterfaces().find(({family, name}) => family === 'IPv4' && /^eth/i.test(name))
console.log(`Register deno.local for [${int?.name}] ${int?.address}`)

const mdns = new mDNS()
mdns.localRecords.set('deno.local', int?.address!)
// mdns.localRecords.set('deno.local', '192.168.100.2')

{
  mdns.start()
  console.log('start')

  // await new Promise((r) => setTimeout(r, 2000))
  // await mdns.query('pc.local')
}

Deno.serve({
  port: 80,
  onListen() {
    console.log(`Listening on http://deno.local`)
  },
}, (req) => {
  console.log(req.url)
  return Response.json({
    time: Temporal.Now.plainDateTimeISO(),
  })
})
