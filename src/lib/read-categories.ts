import { getCollection } from "astro:content";

let readCount = 0;
let lastReadAt: string | null = null;

export async function readCategoriesEnvelope() {
  readCount += 1;
  const entries = await getCollection("categories");
  lastReadAt = new Date().toISOString();

  return {
    readCount,
    lastReadAt,
    entries,
  };
}
