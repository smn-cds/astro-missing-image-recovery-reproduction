# Astro Dev Server Does Not Restore Repro

This is a minimal Astro reproduction for a content collection `image()` bug in `astro dev`.

The issue this repo is trying to demonstrate is not just a stale warning. After a JSON entry is changed to a missing image and then restored to a valid image, the dev server does not recover. The API route that reads the collection should start working again, but it stays broken and the terminal still references the old missing path.

## Setup

```bash
npm install
```

## Repro

1. Start from a clean Astro state:

```bash
rm -rf .astro
```

2. Start the dev server:

```bash
npm run dev
```

3. Request `http://localhost:4321/api/probe` and confirm it returns `200` with JSON like:

```json
{
  "id": "example",
  "imageSrc": "/_astro/seed.hash.webp"
}
```

4. Edit `src/content/categories/example.json` and change:

```json
"image": "./images/seed.webp"
```

to:

```json
"image": "./images/non-existing.jpg"
```

Then request `/api/probe` again and confirm it fails.

5. Restore `src/content/categories/example.json` back to:

```json
"image": "./images/seed.webp"
```

Then request `/api/probe` again.

## Expected Result

Once the valid image path is restored, `/api/probe` should recover and return `200` again.

## Actual Result

`/api/probe` does not recover after the file is fixed. `astro dev` remains stuck on the earlier missing image state, and the terminal continues referencing `./images/non-existing.jpg` even though the JSON entry has already been restored.
