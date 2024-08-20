# Implementation of simple protocols in typescript

## [UPnP Client (RFC 6970)](https://datatracker.ietf.org/doc/html/rfc6970)

The UPnP Client provides a simple interface for managing network port mappings.

### Methods
- `getExternalIp()`: Returns the public IP address.
- `setMapping(options)`: Opens a port with the specified options.
- `getMapping()`: Returns a list of all current port mappings.
- `unmap(options)`: Removes a port mapping with the specified options.
- `unmapAll()`: Removes all port mappings.

Usage:

```ts
#!/usr/bin/env -S deno run -A --unstable-net

import {UPnP} from 'https://raw.githubusercontent.com/MAKS11060/deno-protocols/main/upnp/upnp.ts'

const upnp = new UPnP()

// Get public address
console.log('my ip', await upnp.getExternalIp())

// Open port
await upnp.setMapping({remotePort: 8000, ttl: 150})
console.log('upnp list', await upnp.getMapping())

// Remove port
// await this.unmap({remotePort: 8000})

// Remove all ports
// await this.unmapAll()
```

## [STUN Client (RFC 5389)](https://datatracker.ietf.org/doc/html/rfc5389)

Usage:

```ts
#!/usr/bin/env -S deno run -A --unstable-net

import {STUN} from 'https://raw.githubusercontent.com/MAKS11060/deno-protocols/main/stun/stun.ts'

const stun = new STUN('stun.l.google.com:19302')

console.log(await stun.getMappedAddress()) // { hostname: "178.68.144.103", port: 49646, family: "IPv4" }
```
