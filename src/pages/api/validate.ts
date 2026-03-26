import type { APIRoute } from "astro";
import { z } from "astro:content";
import { readCategoriesEnvelope } from "../../lib/read-categories";

const imageMetadataSchema = z.object({
  src: z.string(),
  width: z.number(),
  height: z.number(),
  format: z.string(),
});

const categorySchema = z.object({
  label: z.string(),
  image: imageMetadataSchema,
});

export const GET: APIRoute = async () => {
  const { entries, readCount, lastReadAt } = await readCategoriesEnvelope();
  const results = entries.map((entry) => ({
    id: entry.id,
    parsed: categorySchema.safeParse(entry.data),
  }));

  const invalid = results.find((result) => !result.parsed.success);

  if (invalid && !invalid.parsed.success) {
    return new Response(
      JSON.stringify(
        {
          id: invalid.id,
          readCount,
          lastReadAt,
          issues: invalid.parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        null,
        2,
      ),
      {
        status: 500,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    );
  }

  return new Response(
    JSON.stringify(
      results.map((result) => ({
        id: result.id,
        valid: true,
        readCount,
        lastReadAt,
      })),
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
