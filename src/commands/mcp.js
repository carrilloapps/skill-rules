import { startMcpServer } from '../mcp/server.js'

export async function mcp() {
  await startMcpServer()
}
