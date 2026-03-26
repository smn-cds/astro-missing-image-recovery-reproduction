# Astro Missing Image Recovery Repro

This is a standalone Astro reproduction for a dev-only stale image warning issue around content collection `image()` fields.

## Target Behavior

1. start from a clean `.astro/`
2. run `astro dev`
3. change `src/content/categories/example.json` from `./images/seed.webp` to `./images/non-existing.jpg`
4. Astro logs the expected missing-image warning or crash
5. restore the JSON back to `images/seed.webp`
6. Astro becomes healthy again, but still appends/logs the stale warning for `images/non-existing.jpg`

## Setup

Install dependencies inside this folder:

```bash
npm install
```

## Run

1. Clean generated Astro state:

```bash
rm -rf .astro
```

2. Start the dev server with log capture:

```bash
npm run dev 2>&1 | tee .sandbox/dev.log
```

3. In another terminal, run the verifier:

```bash
npm run repro
```

If your dev server is not on the default port or your log file lives elsewhere:

```bash
REPRO_LOG_PATH=.sandbox/dev.log \
PROBE_URL=http://localhost:4324/api/probe \
VALIDATE_URL=http://localhost:4324/api/validate \
PAGE_URL=http://localhost:4324/ \
npm run repro
```

## What The Verifier Does

- verifies the page, probe route, and validation route are healthy before starting
- rewrites `example.json` to `./images/non-existing.jpg`
- forces page and API reads until Astro logs the broken path
- restores `example.json` to `./images/seed.webp`
- waits for HTTP behavior to become healthy again
- continues forcing refreshes and inspects only the newly appended part of the dev log
- exits `0` only when Astro appends the stale `images/non-existing.jpg` warning after restore

## Exit Codes

- exit `0`: Astro became healthy again but still logged the stale missing-image path after restore
- exit `1`: the broken image warning never appeared, Astro never returned to healthy HTTP behavior, or Astro recovered cleanly without stale logging

## Environment Variables

- `REPRO_LOG_PATH` default `.sandbox/dev.log`
- `PAGE_URL` default `http://localhost:4321/`
- `PROBE_URL` default `http://localhost:4321/api/probe`
- `VALIDATE_URL` default `http://localhost:4321/api/validate`
- `REPRO_POLL_INTERVAL_MS` default `250`
- `REPRO_SETTLE_DELAY_MS` default `150`
- `REPRO_BROKEN_LOG_TIMEOUT_MS` default `10000`
- `REPRO_RECOVERY_TIMEOUT_MS` default `10000`
- `REPRO_STALE_LOG_TIMEOUT_MS` default `5000`
