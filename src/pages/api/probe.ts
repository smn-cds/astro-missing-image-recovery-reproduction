import type { APIRoute } from "astro";
import { readCategoriesEnvelope } from "../../lib/read-categories";

export const GET: APIRoute = async () => {
  const { entries, readCount, lastReadAt } = await readCategoriesEnvelope();

  const body = entries.map((entry) => {
    const image = entry.data.image;
    const isString = typeof image === "string";

    return {
      id: entry.id,
      imageType: image === null ? "null" : typeof image,
      isString,
      hasSrc: !!image && typeof image === "object" && "src" in image,
      ...(isString ? { rawImageValue: image } : {}),
      readCount,
      lastReadAt,
    };
  });

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
};
