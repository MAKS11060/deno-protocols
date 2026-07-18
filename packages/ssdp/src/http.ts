const decoder = new TextDecoder()
const encoder = new TextEncoder()

export const makeHttpRequest = (options: {
  method: string
  path: string
  httpVersion: 'HTTP/1.1' | 'HTTP/1.0' | 'HTTP/0.9'
  headers: HeadersInit
  body?: string | Uint8Array<ArrayBuffer>
}) => {
  const headLines: string[] = []

  // Start
  headLines.push(`${options.method} ${options.path} ${options.httpVersion}`)

  // headers
  if (Array.isArray(options.headers)) {
    for (const [key, val] of options.headers) {
      headLines.push(`${key}: ${val}`)
    }
  } else if (options.headers && typeof options.headers === 'object') {
    for (const [key, val] of Object.entries(options.headers)) {
      headLines.push(`${key}: ${val}`)
    }
  }

  headLines.push('', '') // end head

  const headBytes = encoder.encode(headLines.join('\r\n'))
  if (options.body === undefined) {
    return headBytes
  }

  // body
  const bodyBytes = typeof options.body === 'string'
    ? encoder.encode(options.body)
    : options.body

  // concat head + body
  const result = new Uint8Array(headBytes.length + bodyBytes.length)
  result.set(headBytes, 0)
  result.set(bodyBytes, headBytes.length)

  return result
}

export const parseHTTPRequest = (data: Uint8Array<ArrayBuffer>) => {
  // parse http
  const http = decoder.decode(data)
  const httpLines = http.split('\r\n')

  // head
  const [method, path, httpVersion] = httpLines[0]?.split(' ') ?? []

  // headers
  const headers = new Headers()
  for (const line of httpLines.slice(1)) {
    if (!line || line.trim() === '') break // end headers

    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    const val = line.slice(colonIndex + 1).trim()
    if (key) headers.append(key, val)
  }

  return {
    method,
    path,
    httpVersion,
    headers,
  }
}

export const parseHttpResponse = (data: Uint8Array<ArrayBuffer>) => {
  const http = decoder.decode(data)
  const httpLines = http.split('\r\n')

  const [httpVersion, statusCode, statusText] = httpLines[0]?.split(' ') ?? []

  // headers
  const headers = new Headers()
  for (const line of httpLines.slice(1)) {
    if (!line || line.trim() === '') break // end headers

    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    const val = line.slice(colonIndex + 1).trim()
    if (key) headers.append(key, val)
  }

  return {
    httpVersion,
    statusCode: Number(statusCode),
    statusText,
    headers,
  }
}
