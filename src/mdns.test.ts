#!/usr/bin/env -S deno run -A --env-file --watch-hmr

import {deepEqual} from 'node:assert/strict'
import {test} from 'node:test'
import {encodeDomainName} from './mdns.ts'

test('Test 341679', async (t) => {
  deepEqual(encodeDomainName('test.local'), new Uint8Array([4, 116, 101, 115, 116, 5, 108, 111, 99, 97, 108, 0]))
  deepEqual(encodeDomainName('test.local.'), new Uint8Array([4, 116, 101, 115, 116, 5, 108, 111, 99, 97, 108, 0]))
})
