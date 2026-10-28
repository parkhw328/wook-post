export const HEADER_NAMES = [
  'Accept',
  'Accept-Charset',
  'Accept-Encoding',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Connection',
  'Content-Disposition',
  'Content-Encoding',
  'Content-Language',
  'Content-Length',
  'Content-Type',
  'Cookie',
  'Date',
  'DNT',
  'Expect',
  'Forwarded',
  'Host',
  'If-Match',
  'If-Modified-Since',
  'If-None-Match',
  'If-Range',
  'If-Unmodified-Since',
  'Origin',
  'Pragma',
  'Prefer',
  'Proxy-Authorization',
  'Range',
  'Referer',
  'TE',
  'Traceparent',
  'Tracestate',
  'Transfer-Encoding',
  'Upgrade',
  'User-Agent',
  'Via',
  'X-API-Key',
  'X-Correlation-ID',
  'X-CSRF-Token',
  'X-Forwarded-For',
  'X-Forwarded-Host',
  'X-Forwarded-Proto',
  'X-Request-ID',
  'X-Requested-With',
]

const contentTypes = [
  'application/json',
  'application/xml',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'application/octet-stream',
  'application/pdf',
  'application/zip',
  'text/plain',
  'text/html',
  'text/csv',
  'image/png',
  'image/jpeg',
]
const values: Record<string, string[]> = {
  accept: [...contentTypes, '*/*'],
  'content-type': contentTypes,
  authorization: ['Bearer ', 'Basic '],
  'proxy-authorization': ['Bearer ', 'Basic '],
  'accept-encoding': ['gzip, deflate, br', 'gzip', 'deflate', 'identity'],
  'accept-language': ['ko-KR,ko;q=0.9,en;q=0.8', 'ko-KR', 'en-US', 'en'],
  'cache-control': ['no-cache', 'no-store', 'max-age=0', 'no-cache, no-store'],
  connection: ['keep-alive', 'close'],
  'content-encoding': ['gzip', 'deflate', 'br'],
  pragma: ['no-cache'],
  'x-requested-with': ['XMLHttpRequest'],
  dnt: ['1', '0'],
}

export function headerValues(name: string): string[] {
  return values[name.trim().toLowerCase()] ?? []
}

export function filterSuggestions(options: string[], query: string): string[] {
  const normalized = query.trim().toLowerCase()
  return options
    .filter((option) => option.toLowerCase().includes(normalized))
    .sort(
      (a, b) =>
        Number(b.toLowerCase().startsWith(normalized)) -
        Number(a.toLowerCase().startsWith(normalized)),
    )
    .slice(0, 8)
}
