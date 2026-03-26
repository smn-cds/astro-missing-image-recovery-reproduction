import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const categoryPath = path.join(projectRoot, "src/content/categories/example.json");
const logPath = path.resolve(projectRoot, process.env.REPRO_LOG_PATH ?? ".sandbox/dev.log");
const pageUrl = process.env.PAGE_URL ?? "http://localhost:4321/";
const probeUrl = process.env.PROBE_URL ?? "http://localhost:4321/api/probe";
const validateUrl = process.env.VALIDATE_URL ?? "http://localhost:4321/api/validate";
const pollIntervalMs = Number(process.env.REPRO_POLL_INTERVAL_MS ?? 250);
const settleDelayMs = Number(process.env.REPRO_SETTLE_DELAY_MS ?? 150);
const brokenLogTimeoutMs = Number(process.env.REPRO_BROKEN_LOG_TIMEOUT_MS ?? 10000);
const recoveryTimeoutMs = Number(process.env.REPRO_RECOVERY_TIMEOUT_MS ?? 10000);
const staleLogTimeoutMs = Number(process.env.REPRO_STALE_LOG_TIMEOUT_MS ?? 5000);

const baselineCategory = {
  label: "Example Category",
  image: "./images/seed.webp",
};

const brokenImagePath = "./images/non-existing.jpg";

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readResponse(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    const text = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      text,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      text: String(error),
    };
  }
}

async function readPage() {
  return readResponse(pageUrl);
}

async function readProbe() {
  return readResponse(probeUrl);
}

async function readValidate() {
  return readResponse(validateUrl);
}

async function getHealthSnapshot() {
  const [pageResponse, probeResponse, validateResponse] = await Promise.all([
    readPage(),
    readProbe(),
    readValidate(),
  ]);

  const probeJson = probeResponse.ok ? safeJsonParse(probeResponse.text) : null;
  const firstProbeEntry = Array.isArray(probeJson) ? probeJson[0] : null;

  const healthy =
    pageResponse.ok &&
    probeResponse.ok &&
    validateResponse.ok &&
    !!firstProbeEntry &&
    firstProbeEntry.isString === false &&
    firstProbeEntry.hasSrc === true;

  return {
    healthy,
    pageResponse,
    probeResponse,
    validateResponse,
    probeJson,
  };
}

async function assertHealthyBaseline() {
  const snapshot = await getHealthSnapshot();

  if (!snapshot.healthy) {
    throw new Error(
      "Baseline is not healthy before the repro starts:\n" + JSON.stringify(snapshot, null, 2),
    );
  }
}

async function writeCategory(imagePath) {
  await writeFile(
    categoryPath,
    JSON.stringify(
      {
        label: baselineCategory.label,
        image: imagePath,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

async function resetToBaseline() {
  await writeCategory(baselineCategory.image);
}

async function ensureLogFileReadable() {
  const directory = path.dirname(logPath);
  await mkdir(directory, { recursive: true });

  try {
    await stat(logPath);
  } catch {
    throw new Error(
      `Dev log file not found at ${logPath}.\nStart Astro with: npm run dev 2>&1 | tee ${path.relative(projectRoot, logPath)}`,
    );
  }
}

async function readLogText() {
  return readFile(logPath, "utf8");
}

function countOccurrences(text, needle) {
  let count = 0;
  let offset = 0;

  while (offset !== -1) {
    offset = text.indexOf(needle, offset);

    if (offset !== -1) {
      count += 1;
      offset += needle.length;
    }
  }

  return count;
}

function summarizeResponse(response) {
  return {
    ok: response.ok,
    status: response.status,
    text: response.text.slice(0, 600),
  };
}

async function waitForBrokenLog(startLogLength) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < brokenLogTimeoutMs) {
    await Promise.all([readPage(), readProbe(), readValidate()]);

    const logText = await readLogText();
    const appended = logText.slice(startLogLength);

    if (appended.includes(brokenImagePath)) {
      return {
        elapsedMs: Date.now() - startedAt,
        logText,
      };
    }

    await sleep(pollIntervalMs);
  }

  const logText = await readLogText();

  throw new Error(
    "Astro never logged the broken image path after the invalid edit.\n" +
      JSON.stringify(
        {
          brokenImagePath,
          logPath,
          timeoutMs: brokenLogTimeoutMs,
          logTail: logText.slice(Math.max(0, logText.length - 1200)),
        },
        null,
        2,
      ),
  );
}

async function waitForHealthyRecovery() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < recoveryTimeoutMs) {
    const snapshot = await getHealthSnapshot();

    if (snapshot.healthy) {
      return {
        elapsedMs: Date.now() - startedAt,
        snapshot,
      };
    }

    await sleep(pollIntervalMs);
  }

  const snapshot = await getHealthSnapshot();

  throw new Error(
    "Astro did not return to a healthy HTTP state after restoring the baseline image.\n" +
      JSON.stringify(
        {
          timeoutMs: recoveryTimeoutMs,
          pageResponse: summarizeResponse(snapshot.pageResponse),
          probeResponse: summarizeResponse(snapshot.probeResponse),
          validateResponse: summarizeResponse(snapshot.validateResponse),
        },
        null,
        2,
      ),
  );
}

async function waitForStaleLog(afterRestoreLogLength, brokenCountBeforeRestore) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < staleLogTimeoutMs) {
    await Promise.all([readPage(), readProbe(), readValidate()]);

    const logText = await readLogText();
    const appended = logText.slice(afterRestoreLogLength);
    const totalBrokenCount = countOccurrences(logText, brokenImagePath);

    if (appended.includes(brokenImagePath) || totalBrokenCount > brokenCountBeforeRestore) {
      return {
        elapsedMs: Date.now() - startedAt,
        appended,
        totalBrokenCount,
      };
    }

    await sleep(pollIntervalMs);
  }

  const logText = await readLogText();

  return {
    elapsedMs: Date.now() - startedAt,
    appended: logText.slice(afterRestoreLogLength),
    totalBrokenCount: countOccurrences(logText, brokenImagePath),
  };
}

async function main() {
  console.log(`Using page: ${pageUrl}`);
  console.log(`Using probe: ${probeUrl}`);
  console.log(`Using validate route: ${validateUrl}`);
  console.log(`Using dev log: ${logPath}`);

  await ensureLogFileReadable();
  await assertHealthyBaseline();

  const initialLogText = await readLogText();
  const initialLogLength = initialLogText.length;

  console.log(`Initial log length: ${initialLogLength} bytes`);
  console.log(`Writing broken image path: ${brokenImagePath}`);

  await writeCategory(brokenImagePath);

  const brokenLog = await waitForBrokenLog(initialLogLength);
  const brokenCountBeforeRestore = countOccurrences(brokenLog.logText, brokenImagePath);

  console.log(
    `Observed broken image path in the dev log after ${brokenLog.elapsedMs}ms (${brokenCountBeforeRestore} total matches so far).`,
  );

  await resetToBaseline();
  await sleep(settleDelayMs);

  const afterRestoreLogLength = (await readLogText()).length;
  const healthyRecovery = await waitForHealthyRecovery();

  console.log(`Astro returned to a healthy HTTP state after ${healthyRecovery.elapsedMs}ms.`);

  const staleLog = await waitForStaleLog(afterRestoreLogLength, brokenCountBeforeRestore);

  if (staleLog.appended.includes(brokenImagePath)) {
    console.log("Observed stale broken-image logging after restoring the baseline content:");
    console.log(
      JSON.stringify(
        {
          brokenImagePath,
          healthyRecoveryElapsedMs: healthyRecovery.elapsedMs,
          staleLogElapsedMs: staleLog.elapsedMs,
          appendedLogExcerpt: staleLog.appended.slice(-1200),
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  console.error("Astro recovered cleanly: no stale broken-image log entry was appended after restore.");
  console.error(
    JSON.stringify(
      {
        brokenImagePath,
        healthyRecoveryElapsedMs: healthyRecovery.elapsedMs,
        staleLogElapsedMs: staleLog.elapsedMs,
        brokenCountBeforeRestore,
        brokenCountAfterRestore: staleLog.totalBrokenCount,
        appendedLogExcerpt: staleLog.appended.slice(-1200),
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await sleep(settleDelayMs);
  await resetToBaseline();
}
