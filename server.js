// Rose Baghdad catalogue: read-only MCP server (public store data only)
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const CATALOG = JSON.parse(readFileSync(new URL('./catalog.json', import.meta.url), 'utf8'));
const PORT = process.env.PORT || 3000;

function makeServer() {
  const server = new McpServer({ name: 'rose-baghdad-catalog', version: '1.0.0' });
  const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

  server.registerTool('search_products', {
    title: 'Search Rose Baghdad products',
    description: 'Search the Rose Baghdad product list by a word in the Arabic or English name, description or notes, and optionally filter by category (perfumes, incense, musk). Returns id, names, category and price in IQD.',
    inputSchema: {
      query: z.string().optional().describe('Word to search for'),
      category: z.enum(['perfumes', 'incense', 'musk']).optional().describe('Category filter'),
    },
    annotations: readOnly,
  }, async ({ query, category }) => {
    const q = (query || '').trim().toLowerCase();
    const items = CATALOG.filter(p =>
      (!category || p.category === category) &&
      (!q || [p.name_ar, p.name_en, p.desc_ar, p.desc_en, p.ingredients_ar, p.ingredients_en]
        .some(t => (t || '').toLowerCase().includes(q)))
    ).map(({ id, category, name_ar, name_en, price_iqd }) => ({ id, category, name_ar, name_en, price_iqd, buy_url: `https://www.rosebaghdad.iq/#product-${id}` }));
    return { content: [{ type: 'text', text: JSON.stringify({ count: items.length, products: items }, null, 1) }] };
  });

  server.registerTool('get_product', {
    title: 'Get a Rose Baghdad product',
    description: 'Get full details of one Rose Baghdad product by its id (from search_products): names, category, price in IQD, description and notes in Arabic and English.',
    inputSchema: { id: z.string().describe('Product id, for example rb-good-girl') },
    annotations: readOnly,
  }, async ({ id }) => {
    const p = CATALOG.find(x => x.id === id);
    const text = p ? JSON.stringify({ ...p, buy_url: `https://www.rosebaghdad.iq/#product-${p.id}` }, null, 1) : JSON.stringify({ error: 'not_found', id });
    return { content: [{ type: 'text', text }], isError: !p };
  });

  return server;
}

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }).end('ok'); return; }
  if (url.pathname !== '/mcp') { res.writeHead(404).end(); return; }
  if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }).end(); return; }

  let body = '';
  for await (const chunk of req) body += chunk;
  let parsed;
  try { parsed = body ? JSON.parse(body) : undefined; } catch { res.writeHead(400).end('bad json'); return; }

  const server = makeServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => { transport.close(); server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, parsed);
});

httpServer.listen(PORT, () => console.log(`rose-baghdad-catalog MCP on :${PORT}/mcp`));
