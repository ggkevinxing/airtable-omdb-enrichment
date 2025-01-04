import { EnrichmentService } from "./src/EnrichmentService";

async function main() {
  console.log("Hello world");
  const enrichmentService = new EnrichmentService();
  await enrichmentService.enrichMetadata();
}

main();
