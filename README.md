# Rose Baghdad catalogue (MCP connector)

A read-only Model Context Protocol server that gives Claude the public Rose Baghdad product list: names, categories, prices in IQD, descriptions and notes. It has two tools: `search_products` and `get_product`. Both only read.

## Data

This server returns public product information only. It does not read or store orders, customers, payments or accounts, and it keeps no records of the people who use it.

## Privacy policy

This connector collects no personal data. It serves a fixed public catalogue and keeps no logs of individual users beyond what the hosting provider keeps for operating the service.

## Support

Report a problem or ask a question at https://github.com/ahmedmaarej-lab/rose-baghdad-catalog-mcp/issues, or visit https://www.rosebaghdad.iq.

## Run locally

    npm install
    npm start

The endpoint is `POST /mcp` on port 3000 (or `PORT`).
