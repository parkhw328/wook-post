import { createServer } from 'node:http'

const server = createServer(async (request, response) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(
    JSON.stringify(
      {
        message: 'wPost에 오신 것을 환영합니다.',
        method: request.method,
        path: request.url,
        headers: request.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      },
      null,
      2,
    ),
  )
})
server.listen(4545, '127.0.0.1', () => console.log('wPost 테스트 서버: http://127.0.0.1:4545'))
