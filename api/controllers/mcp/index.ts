import type { FastifyReply, FastifyRequest } from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { MCP_TOOLS } from './tools.js';

const McpController = {
  // Servidor stateless: um McpServer novo por requisição, sem sessão. A rota só aceita POST.
  handle: async function (req: FastifyRequest, res: FastifyReply) {
    const { mcp_user_id: user_id } = req;
    const server = new McpServer({ name: 'calory', version: '0.1.0' });

    for (const tool of MCP_TOOLS) {
      server.registerTool(tool.name, { description: tool.description, inputSchema: tool.inputSchema }, async (args) => {
        const { status, body } = await tool.run(args, { user_id, log: req.log });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(body) }],
          isError: status >= 400,
        };
      });
    }

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.raw.on('close', () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    res.hijack();
    await transport.handleRequest(req.raw, res.raw, req.body);
  },
};

export default McpController;
