#!/usr/bin/env npx tsx
/**
 * deploy-smartthings.ts — SmartThings Edge Driver deployment via SDK
 * Usage: npx tsx smartthings-edge-driver/scripts/deploy-smartthings.ts [deploy|update|logs]
 *        or via `make smart-deploy`
 */
import {
  SmartThingsClient,
  BearerTokenAuthenticator,
} from "@smartthings/core-sdk";
import type {
  CapabilityCreate,
  CapabilityPresentationCreate,
} from "@smartthings/core-sdk";
import archiver from "archiver";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { spawn } from "node:child_process";

// ── paths ───────────────────────────────────────────────────────────
const DRIVER_DIR = path.resolve(__dirname, "..");
const CAPABILITIES_DIR = path.join(DRIVER_DIR, "capabilities");
const STATE_FILE = path.join(DRIVER_DIR, ".smartthings-state");
const REPO_ROOT = path.resolve(DRIVER_DIR, "..");
const ENV_FILE = path.join(REPO_ROOT, ".env");
const TOKEN_PAGE_URL = "https://account.smartthings.com/tokens";
const REQUIRED_SCOPES = [
  "r:devices:*",
  "r:hubs:*",
  "r:locations:*",
  "w:devices:*",
  "x:devices:*",
  "r:scenes:*",
  "x:scenes:*",
];

const CAPS = [
  "mqttStatus",
  "forceCharge",
  "forceExport",
  "dischargeRate",
  "targetSoc",
  "batteryReserve",
  "inverterInfo",
  "energyStats",
  "pauseSchedule",
];

// ── helpers ─────────────────────────────────────────────────────────
function die(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function info(msg: string) {
  console.log(`==> ${msg}`);
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    if (name === "SMARTTHINGS_TOKEN") {
      die(
        `${name} is not set.\n` +
          `Run 'make smart-login' to generate and store a Personal Access Token.`,
      );
    }
    die(`Required variable ${name} is not set. Add it to .env`);
  }
  return val;
}

function isAuthError(err: unknown): boolean {
  const msg = (err as Error)?.message || "";
  return /\b401\b|Unauthorized|Authorization Required/i.test(msg);
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function tryOpenBrowser(url: string) {
  const browser = process.env.BROWSER;
  const cmd =
    browser ||
    (process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open");
  try {
    spawn(cmd, [url], {
      stdio: "ignore",
      detached: true,
      shell: process.platform === "win32",
    }).unref();
  } catch {
    // best-effort only
  }
}

// ── .env persistence ────────────────────────────────────────────────
function upsertEnvVar(name: string, value: string) {
  let lines: string[] = [];
  if (fs.existsSync(ENV_FILE)) {
    lines = fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/);
  }
  const re = new RegExp(`^\\s*${name}\\s*=`);
  let replaced = false;
  lines = lines.map((line) => {
    if (re.test(line)) {
      replaced = true;
      return `${name}=${value}`;
    }
    return line;
  });
  if (!replaced) {
    if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
    lines.push(`${name}=${value}`);
  }
  // Ensure trailing newline
  let content = lines.join("\n");
  if (!content.endsWith("\n")) content += "\n";
  fs.writeFileSync(ENV_FILE, content, { mode: 0o600 });
}

// ── state management ────────────────────────────────────────────────
type State = Record<string, string>;

function loadState(): State {
  if (!fs.existsSync(STATE_FILE)) return {};
  const lines = fs.readFileSync(STATE_FILE, "utf8").split("\n");
  const state: State = {};
  for (const line of lines) {
    const idx = line.indexOf("=");
    if (idx > 0) state[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return state;
}

function saveState(key: string, value: string) {
  const state = loadState();
  state[key] = value;
  const content = Object.entries(state)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  fs.writeFileSync(STATE_FILE, content + "\n");
}

// ── step 1: register capabilities ──────────────────────────────────
async function registerCapabilities(
  client: SmartThingsClient,
  existingNamespace?: string,
): Promise<string> {
  info("Registering custom capabilities...");
  let namespace = existingNamespace || "";

  for (const cap of CAPS) {
    const schemaPath = path.join(CAPABILITIES_DIR, `${cap}.json`);
    if (!fs.existsSync(schemaPath))
      die(`Missing capability schema: ${schemaPath}`);

    const raw = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    // Strip id/version — the API assigns these on creation
    const { id: _id, version: _ver, ...capData } = raw;
    const capability: CapabilityCreate = capData;

    info(`  Creating capability: ${cap}`);
    let capId: string;
    try {
      const result = await client.capabilities.create(capability);
      if (!result.id) die(`Failed to parse capability ID for ${cap}`);
      capId = result.id;
    } catch (e: unknown) {
      const msg = (e as Error).message || "";
      if (
        msg.includes("409") ||
        msg.includes("already exists") ||
        msg.includes("Conflict")
      ) {
        // Capability already registered — discover namespace from existing caps
        if (namespace) {
          capId = `${namespace}.${cap}`;
          console.log(`  ⊘ ${capId} (already exists)`);
          continue;
        }
        // Need namespace — list namespaces to find it
        const namespaces = await client.capabilities.listNamespaces();
        if (namespaces.length > 0) {
          namespace = namespaces[0].name;
          capId = `${namespace}.${cap}`;
          saveState("SMARTTHINGS_NAMESPACE", namespace);
          info(`  Namespace discovered: ${namespace}`);
          console.log(`  ⊘ ${capId} (already exists)`);
          continue;
        }
        die(
          `Capability ${cap} already exists but could not determine namespace`,
        );
      }
      throw e;
    }

    if (!namespace) {
      namespace = capId.split(".")[0];
      info(`  Namespace discovered: ${namespace}`);
      saveState("SMARTTHINGS_NAMESPACE", namespace);
    }

    console.log(`  ✓ ${capId}`);
  }

  return namespace;
}

// ── step 2: replace namespace placeholders ─────────────────────────
function replacePlaceholders(namespace: string) {
  info(`Replacing <ns> placeholders with namespace: ${namespace}`);

  const files = [
    path.join(DRIVER_DIR, "profiles", "givenergy-battery.yml"),
    path.join(DRIVER_DIR, "src", "capabilities_ref.lua"),
  ];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    fs.writeFileSync(file, content.replace(/<ns>/g, namespace));
  }

  // Verify no placeholders remain
  const dirs = [
    path.join(DRIVER_DIR, "profiles"),
    path.join(DRIVER_DIR, "src"),
  ];
  for (const dir of dirs) {
    for (const f of fs.readdirSync(dir, { recursive: true })) {
      const fp = path.join(dir, f as string);
      if (fs.statSync(fp).isFile()) {
        const content = fs.readFileSync(fp, "utf8");
        if (content.includes("<ns>")) {
          die(`Namespace placeholder still found in ${fp}`);
        }
      }
    }
  }

  console.log("  ✓ No <ns> placeholders remaining");
}

// ── step 3: register presentations ─────────────────────────────────
async function registerPresentations(
  client: SmartThingsClient,
  namespace: string,
) {
  info("Registering capability presentations...");

  for (const cap of CAPS) {
    const presPath = path.join(CAPABILITIES_DIR, `${cap}.presentation.json`);
    if (!fs.existsSync(presPath)) die(`Missing presentation: ${presPath}`);

    const presData = JSON.parse(fs.readFileSync(presPath, "utf8"));
    const capId = `${namespace}.${cap}`;
    const presentation: CapabilityPresentationCreate = {
      id: capId,
      version: 1,
      ...presData,
    };

    info(`  Creating presentation: ${capId}`);
    try {
      await client.capabilities.createPresentation(capId, 1, presentation);
      console.log(`  ✓ ${capId}`);
    } catch (e: unknown) {
      const msg = (e as Error).message || "";
      if (
        msg.includes("409") ||
        msg.includes("already exists") ||
        msg.includes("Conflict")
      ) {
        console.log(`  ⊘ ${capId} (already exists)`);
      } else if (msg.includes("403")) {
        // SDK presentation endpoint may 403 — fall back to direct REST
        const token = requireEnv("SMARTTHINGS_TOKEN");
        const res = await fetch(
          `https://api.smartthings.com/v1/capabilities/${capId}/1/presentation`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(presData),
          },
        );
        if (res.ok) {
          console.log(`  ✓ ${capId} (via REST fallback)`);
        } else {
          const body = await res.text();
          die(`Presentation ${capId}: ${res.status} ${body}`);
        }
      } else {
        throw e;
      }
    }
  }
}

// ── delete capability ──────────────────────────────────────────────
async function deleteCapability(
  client: SmartThingsClient,
  namespace: string,
  capName: string,
): Promise<boolean> {
  const capId = `${namespace}.${capName}`;
  info(`  Deleting capability: ${capId}`);
  try {
    await client.capabilities.delete(capId, 1);
    console.log(`  ✓ Deleted ${capId}`);
    return true;
  } catch (e: unknown) {
    const msg = (e as Error).message || "";
    if (msg.includes("404") || msg.includes("Not Found")) {
      console.log(`  ⊘ ${capId} (not found)`);
      return false;
    }
    throw e;
  }
}

// ── step 4: create channel ─────────────────────────────────────────
async function ensureChannel(
  client: SmartThingsClient,
  state: State,
): Promise<string> {
  if (state.SMARTTHINGS_CHANNEL_ID) {
    info(`Using existing channel: ${state.SMARTTHINGS_CHANNEL_ID}`);
    return state.SMARTTHINGS_CHANNEL_ID;
  }

  info("Creating distribution channel...");
  const channel = await client.channels.create({
    name: "GivEnergy Battery",
    description: "GivTCP MQTT battery driver",
    type: "DRIVER",
    termsOfServiceUrl: "",
  });

  saveState("SMARTTHINGS_CHANNEL_ID", channel.channelId);
  console.log(`  ✓ Channel: ${channel.channelId}`);
  return channel.channelId;
}

// ── step 5: package and upload ─────────────────────────────────────
async function packageAndUpload(client: SmartThingsClient): Promise<{
  driverId: string;
  version: string;
}> {
  info("Packaging and uploading driver...");

  const zipBuffer = await createDriverZip();
  const result = await client.drivers.upload(new Uint8Array(zipBuffer));

  if (!result.driverId) die("Failed to parse driver ID from upload response");

  saveState("SMARTTHINGS_DRIVER_ID", result.driverId);
  saveState("SMARTTHINGS_DRIVER_VERSION", result.version);
  console.log(`  ✓ Driver: ${result.driverId} (v${result.version})`);
  return { driverId: result.driverId, version: result.version };
}

function createDriverZip(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);

    // Add driver contents (config.yml, profiles/, src/)
    archive.file(path.join(DRIVER_DIR, "config.yml"), { name: "config.yml" });
    archive.directory(path.join(DRIVER_DIR, "profiles"), "profiles");
    archive.directory(path.join(DRIVER_DIR, "src"), "src");

    archive.finalize();
  });
}

// ── step 6: assign to channel, enroll hub, install ─────────────────
async function installOnHub(
  client: SmartThingsClient,
  channelId: string,
  driverId: string,
  driverVersion: string,
  hubId: string,
) {
  info("Assigning driver to channel...");
  try {
    await client.channels.assignDriver(channelId, driverId, driverVersion);
    console.log("  ✓ Assigned");
  } catch (e: unknown) {
    console.log(`  ⚠ Assign: ${(e as Error).message}`);
  }

  info("Enrolling hub in channel...");
  try {
    await client.channels.enrollHub(channelId, hubId);
    console.log("  ✓ Enrolled");
  } catch (e: unknown) {
    console.log(`  ⚠ Enroll: ${(e as Error).message}`);
  }

  info("Installing driver on hub...");
  try {
    await client.hubdevices.installDriver(driverId, hubId, channelId);
    console.log("  ✓ Installed");
  } catch (e: unknown) {
    console.log(`  ⚠ Install: ${(e as Error).message}`);
  }
}

// ── commands ────────────────────────────────────────────────────────
async function deploy(client: SmartThingsClient) {
  const state = loadState();

  let namespace = state.SMARTTHINGS_NAMESPACE;
  if (!namespace) {
    namespace = await registerCapabilities(client);
  } else {
    // Register any new capabilities that were added since initial deploy
    await registerCapabilities(client, namespace);
  }

  replacePlaceholders(namespace);
  await registerPresentations(client, namespace);

  const channelId = await ensureChannel(client, state);
  const { driverId, version } = await packageAndUpload(client);
  await installOnHub(
    client,
    channelId,
    driverId,
    version,
    requireEnv("SMARTTHINGS_HUB_ID"),
  );

  console.log("");
  info("Deployment complete.");
  info(
    "Open the SmartThings app → Add Device → Scan Nearby to discover the GivEnergy Battery device.",
  );
  info("Then configure Broker IP, Inverter Serial in device settings.");
}

async function update(client: SmartThingsClient) {
  const state = loadState();
  const channelId = state.SMARTTHINGS_CHANNEL_ID;
  if (!channelId) die("No channel ID found. Run 'deploy' first.");

  const hubId = requireEnv("SMARTTHINGS_HUB_ID");
  const { driverId, version } = await packageAndUpload(client);
  try {
    await client.channels.assignDriver(channelId, driverId, version);
  } catch {
    // May already be assigned
  }

  info("Installing updated driver on hub...");
  try {
    await client.hubdevices.installDriver(driverId, hubId, channelId);
    console.log("  ✓ Installed on hub");
  } catch (e: unknown) {
    console.log(`  ⚠ Install: ${(e as Error).message}`);
  }

  console.log("");
  info("Driver updated and pushed to hub.");
}

// ── main ────────────────────────────────────────────────────────────
async function login() {
  info("SmartThings Personal Access Token login");
  console.log("");
  console.log(
    `Open this URL in a browser and create a new Personal Access Token:`,
  );
  console.log(`  ${TOKEN_PAGE_URL}`);
  console.log("");
  console.log(`Required scopes (tick all of these when generating):`);
  for (const s of REQUIRED_SCOPES) console.log(`  - ${s}`);
  console.log("");
  console.log(
    `Note: SmartThings PATs expire 24 hours after creation, so you may need to repeat this periodically.`,
  );
  console.log("");

  tryOpenBrowser(TOKEN_PAGE_URL);

  const token = await prompt("Paste your Personal Access Token: ");
  if (!token) die("No token entered.");
  if (!/^[A-Za-z0-9-]{20,}$/.test(token)) {
    die("That doesn't look like a valid PAT (expected a long token string).");
  }

  // Validate against the API
  info("Validating token...");
  const res = await fetch("https://api.smartthings.com/v1/locations", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    die(
      "SmartThings rejected the token (401). Double-check you copied it correctly and that it hasn't expired.",
    );
  }
  if (!res.ok) {
    const body = await res.text();
    die(`Token validation failed: ${res.status} ${body}`);
  }
  const locations = (await res.json()) as { items?: Array<{ name: string }> };
  console.log(
    `  ✓ Token accepted (${locations.items?.length ?? 0} location(s) visible).`,
  );

  upsertEnvVar("SMARTTHINGS_TOKEN", token);
  info(`Saved SMARTTHINGS_TOKEN to ${ENV_FILE}`);

  if (!process.env.SMARTTHINGS_HUB_ID) {
    info(
      "Tip: SMARTTHINGS_HUB_ID is not set. Discover it with:\n" +
        "  curl -s -H 'Authorization: Bearer $SMARTTHINGS_TOKEN' https://api.smartthings.com/v1/hubs | jq '.items[] | {name, hubId: .id}'",
    );
  }
}

async function main() {
  const command = process.argv[2] || "deploy";

  if (command === "login") {
    await login();
    return;
  }

  const token = requireEnv("SMARTTHINGS_TOKEN");
  requireEnv("SMARTTHINGS_HUB_ID");

  const client = new SmartThingsClient(new BearerTokenAuthenticator(token));

  switch (command) {
    case "deploy":
      await deploy(client);
      break;
    case "update":
      await update(client);
      break;
    case "redeploy": {
      const capsToRedeploy = process.argv.slice(3);
      if (capsToRedeploy.length === 0) {
        die(
          "Usage: deploy-smartthings.ts redeploy <cap1> [cap2] ...\nExample: deploy-smartthings.ts redeploy pauseSchedule",
        );
      }
      const state = loadState();
      const namespace = state.SMARTTHINGS_NAMESPACE;
      if (!namespace) die("No namespace found. Run 'deploy' first.");

      info(`Redeploying capabilities: ${capsToRedeploy.join(", ")}`);

      // Validate all caps exist in CAPS list
      for (const cap of capsToRedeploy) {
        if (!CAPS.includes(cap)) {
          die(`Unknown capability: ${cap}. Must be one of: ${CAPS.join(", ")}`);
        }
      }

      // Delete specified capabilities
      for (const cap of capsToRedeploy) {
        await deleteCapability(client, namespace, cap);
      }

      // Re-register capabilities (only the specified ones)
      const filteredCaps = CAPS.filter((c) => capsToRedeploy.includes(c));
      for (const cap of filteredCaps) {
        const schemaPath = path.join(CAPABILITIES_DIR, `${cap}.json`);
        const raw = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
        const { id: _id, version: _ver, ...capData } = raw;
        const capability: CapabilityCreate = capData;
        info(`  Re-creating capability: ${cap}`);
        try {
          const result = await client.capabilities.create(capability);
          console.log(`  ✓ ${result.id}`);
        } catch (e: unknown) {
          throw e;
        }
      }

      // Re-register presentations
      for (const cap of filteredCaps) {
        const presPath = path.join(
          CAPABILITIES_DIR,
          `${cap}.presentation.json`,
        );
        const presData = JSON.parse(fs.readFileSync(presPath, "utf8"));
        const capId = `${namespace}.${cap}`;
        const presentation: CapabilityPresentationCreate = {
          id: capId,
          version: 1,
          ...presData,
        };
        info(`  Re-creating presentation: ${capId}`);
        try {
          await client.capabilities.createPresentation(capId, 1, presentation);
          console.log(`  ✓ ${capId}`);
        } catch (e: unknown) {
          const msg = (e as Error).message || "";
          if (msg.includes("403")) {
            const token = requireEnv("SMARTTHINGS_TOKEN");
            const res = await fetch(
              `https://api.smartthings.com/v1/capabilities/${capId}/1/presentation`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(presData),
              },
            );
            if (res.ok) {
              console.log(`  ✓ ${capId} (via REST fallback)`);
            } else {
              const body = await res.text();
              die(`Presentation ${capId}: ${res.status} ${body}`);
            }
          } else {
            throw e;
          }
        }
      }

      // Re-upload driver package
      const channelId = state.SMARTTHINGS_CHANNEL_ID;
      if (channelId) {
        const { driverId, version } = await packageAndUpload(client);
        try {
          await client.channels.assignDriver(channelId, driverId, version);
        } catch {
          // May already be assigned
        }
        info("Driver re-uploaded. Hub will auto-update within ~60 seconds.");
      }

      info("Redeploy complete.");
      break;
    }
    case "logs": {
      const hubId = requireEnv("SMARTTHINGS_HUB_ID");
      const state = loadState();
      const driverId = state.SMARTTHINGS_DRIVER_ID;
      if (!driverId) die("No driver ID found. Run 'deploy' first.");

      info(`Streaming logs for driver ${driverId} on hub ${hubId}...`);
      info("Press Ctrl+C to stop.\n");

      const token = requireEnv("SMARTTHINGS_TOKEN");

      // Try cloud logcat endpoint first, fall back to listing installed drivers
      const res = await fetch(
        `https://api.smartthings.com/v1/hubdevices/${hubId}/drivers/${driverId}/logcat`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        if (!res.body) die("No response body from logcat endpoint");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          process.stdout.write(decoder.decode(value, { stream: true }));
        }
      } else if (res.status === 403) {
        console.error(
          "Logcat endpoint returned 403. Your PAT may lack the required scope.\n" +
            "To view logs, use the SmartThings app:\n" +
            "  Menu → Hub → Drivers → GivEnergy Battery → Logs\n" +
            "Or visit: https://my.smartthings.com/advanced/hubs/" +
            hubId,
        );
        process.exit(1);
      } else {
        const body = await res.text();
        die(`Logcat failed: ${res.status} ${body}`);
      }
      break;
    }
    default:
      console.log(
        "Usage: deploy-smartthings.ts {login|deploy|update|redeploy <caps...>|logs}",
      );
      process.exit(1);
  }
}

main().catch((err) => {
  if (isAuthError(err)) {
    console.error(
      "\nERROR: SmartThings rejected the request with 401 Unauthorized.\n" +
        "Your SMARTTHINGS_TOKEN is missing, invalid, or expired (PATs expire 24h after creation).\n" +
        "Run:  make smart-login\n",
    );
    process.exit(1);
  }
  console.error("ERROR:", err.message || err);
  process.exit(1);
});
