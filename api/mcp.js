// Vercel entry point: same read-only Rose Baghdad catalogue MCP server, served at /api/mcp
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import CATALOG from '../catalog.json' with { type: 'json' };

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
    ).map(({ id, category, name_ar, name_en, price_iqd }) => ({ id, category, name_ar, name_en, price_iqd }));
    return { content: [{ type: 'text', text: JSON.stringify({ count: items.length, products: items }, null, 1) }] };
  });

  server.registerTool('get_product', {
    title: 'Get a Rose Baghdad product',
    description: 'Get full details of one Rose Baghdad product by its id (from search_products): names, category, price in IQD, description and notes in Arabic and English.',
    inputSchema: { id: z.string().describe('Product id, for example rb-good-girl') },
    annotations: readOnly,
  }, async ({ id }) => {
    const p = CATALOG.find(x => x.id === id);
    const text = p ? JSON.stringify(p, null, 1) : JSON.stringify({ error: 'not_found', id });
    return { content: [{ type: 'text', text }], isError: !p };
  });

  return server;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('allow', 'POST'); res.end(); return; }
  let body = req.body;
  if (body === undefined) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    try { body = raw ? JSON.parse(raw) : undefined; } catch { res.statusCode = 400; res.end('bad json'); return; }
  }
  const server = makeServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => { transport.close(); server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}
