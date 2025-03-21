import fs from 'fs'
import http from 'http'
import path from 'path'

import 'dotenv/config'

function createServer(port) {
  const DEVELOPMENT_ABC_LOCATION = process.env.DEVELOPMENT_ABC_LOCATION

  console.log(`Starting development server http://localhost:${port}/ for api proxy.`)
  console.log('  Using ABC location: ' + DEVELOPMENT_ABC_LOCATION)

  http
    .createServer(function (req, res) {
      let filename = req.url.replace(/^\/abc/, '')
      let fullPath = path.join(DEVELOPMENT_ABC_LOCATION, filename)
      if (!fs.existsSync(fullPath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.write('404 Not Found\n')
        res.end()
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.write(fs.readFileSync(fullPath))
        res.end()
      }
    })
    .listen(port)
}

export default { createServer }
