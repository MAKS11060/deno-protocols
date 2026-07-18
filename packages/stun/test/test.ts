#!/usr/bin/env -S deno run -A --unstable-net --watch-hmr

import {STUN} from '../src/mod.ts'

const stun = new STUN({uri: 'stun.l.google.com:19302'})
console.log(await stun.getMappedAddress())
