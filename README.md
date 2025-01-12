# airtable-omdb-enrichment

An extremely specific bespoke solution to enriching the metadata of the Airtable spreadsheet that lists the films and tv shows my significant other and I watch together. Uses Node and TypeScript to bring data from outside sources into Airtable. Feel free to use as a jumping off point of inspiration.

1. Set up your `.env` using `.env.example`
2. Edit `EnrichmentService.ts` based on the fields you want to use (and add/remove as much enrichment as you please)
3. Run with `ts-node main.ts`
