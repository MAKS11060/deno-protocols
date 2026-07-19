#!/usr/bin/env -S deno run -A --unstable-net --watch-hmr

import {SSDP} from './ssdp.ts'

const ssdp = new SSDP()

console.log(await ssdp.search('ssdp:all'))
