import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { defineCollection } from "astro:content";

const categories = defineCollection({
  loader: glob({ pattern: "*.json", base: "./src/content/categories" }),
  schema: ({ image }) =>
    z.object({
      label: z.string(),
      image: image(),
    }),
});

export const collections = { categories };
