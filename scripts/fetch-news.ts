import { fetchAndStoreNews } from "../src/lib/news-fetcher";

async function main() {
  console.log("Fetching latest articles from all sources...");
  const result = await fetchAndStoreNews();
  console.log(`Fetched: ${result.fetched}`);
  console.log(`Stored (new): ${result.stored}`);
  if (result.errors.length > 0) {
    console.log(`Errors (${result.errors.length}):`);
    result.errors.forEach((e) => console.log(`  - ${e}`));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
