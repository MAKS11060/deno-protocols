#!/usr/bin/env -S node --watch

import {SSDP} from './ssdp.ts'

const ssdp = new SSDP()

console.log(await ssdp.search('ssdp:all'))
