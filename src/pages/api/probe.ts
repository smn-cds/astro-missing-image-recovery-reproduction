import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const GET: APIRoute = async () => {
  const entry = (await getCollection("categories"))[0]!;

  return new Response(
    JSON.stringify(
      {
        id: entry.id,
        imageSrc: entry.data.image.src,
      },
      null,
      2,
    ),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
};
