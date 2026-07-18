#!/usr/bin/env -S node --watch

import {SSDP} from '../src/mod.ts'

const ssdp = new SSDP()

console.log(await ssdp.search('ssdp:all'))
