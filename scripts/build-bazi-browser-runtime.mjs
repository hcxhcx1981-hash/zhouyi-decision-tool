import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const defaultOutput = join(projectRoot, "public", "bazi-runtime", "v0.1");
const sourceCommit = "e6ee07f3e67f7ce295d2af015eedc028274834a9";
const expected = Object.freeze({
  rules: "bd5a534ac449c838dbdb9b49f7ac7447da2b95d35d5ba215d8d33cf965e1d9da",
  solar: "0e22ce7738ee0aedfb15056a3888959907a2e0b88b06ed2b54bce838fc5d5ea2",
  timezone: "a15f271214fb2b595856d93c365ed6beb6dfbfbb429d6b3c2fa0fc9b58d7c6c2",
  location: "1635c8cf0c64bf30169027feea073cf6b7d5fa3bfec9828961752cbcc620cb94",
});

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function stableBytes(value) {
  return Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
}

function readFrozen(relativePath, expectedSha) {
  const path = join(projectRoot, relativePath);
  const bytes = readFileSync(path);
  if (digest(bytes) !== expectedSha) throw new Error(`FROZEN_SHA_MISMATCH:${relativePath}`);
  return { bytes, value: JSON.parse(bytes.toString("utf8")) };
}

function writeJson(root, relativePath, value) {
  const bytes = stableBytes(value);
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  return { path: `/bazi-runtime/v0.1/${relativePath.replaceAll("\\", "/")}`, sha256: digest(bytes), byte_size: bytes.length };
}

function outputArgument() {
  const index = process.argv.indexOf("--output");
  if (index === -1) return defaultOutput;
  if (!process.argv[index + 1]) throw new Error("OUTPUT_PATH_REQUIRED");
  return resolve(process.argv[index + 1]);
}

function replaceAtomically(tempRoot, destination) {
  const backup = `${destination}.previous`;
  if (existsSync(backup)) rmSync(backup, { recursive: true, force: true });
  if (!existsSync(destination)) {
    renameSync(tempRoot, destination);
    return;
  }
  renameSync(destination, backup);
  try {
    renameSync(tempRoot, destination);
    rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (existsSync(destination)) rmSync(destination, { recursive: true, force: true });
    renameSync(backup, destination);
    throw error;
  }
}

function build(destination) {
  const rules = readFrozen("data/frozen/bazi/bazi_calendar_rules_v0.1.1.json", expected.rules);
  const solar = readFrozen("data/frozen/bazi/solar_terms_1969_2101_v0.1.0.json", expected.solar);
  const timezone = readFrozen("data/frozen/bazi_timezone/iana_tzdb_2026c_v0.1.0.json", expected.timezone);
  const location = readFrozen("data/frozen/bazi_location/iana_location_registry_2026c_v0.1.0.json", expected.location);
  if (timezone.value.zone_count !== 598 || timezone.value.zones.length !== 598) throw new Error("TIMEZONE_ZONE_COUNT_MISMATCH");
  if (solar.value.record_count !== 3192 || solar.value.records.length !== 3192) throw new Error("SOLAR_RECORD_COUNT_MISMATCH");
  mkdirSync(dirname(destination), { recursive: true });
  const tempRoot = mkdtempSync(join(dirname(destination), ".bazi-runtime-v0.1-"));
  try {
    const locationAsset = writeJson(tempRoot, "location/registry.json", {
      ...location.value,
      derived_asset_status: "DERIVED_RUNTIME_ASSET",
      source_frozen_sha256: expected.location,
    });

    const timezoneEntries = timezone.value.zones.map((zone, index) => {
      const asset = writeJson(tempRoot, `timezone/zones/${String(index).padStart(4, "0")}.json`, {
        zone_id: zone.zone_id,
        initial_state: zone.initial_state,
        transitions: zone.transitions,
        source_dataset_id: timezone.value.dataset_id,
        source_dataset_version: timezone.value.version,
        source_dataset_sha256: expected.timezone,
      });
      return { zone_id: zone.zone_id, ...asset };
    });
    const timezoneIndexAsset = writeJson(tempRoot, "timezone/index.json", {
      dataset_id: timezone.value.dataset_id,
      version: timezone.value.version,
      status: "DERIVED_RUNTIME_INDEX",
      source_dataset_sha256: expected.timezone,
      iana_release: timezone.value.iana_release,
      python_tzdata_version: timezone.value.python_tzdata_version,
      coverage: timezone.value.coverage,
      timestamp_resolution: timezone.value.timestamp_resolution,
      source_zone_count: timezone.value.zone_count,
      source_transition_count: timezone.value.transition_count,
      special_behavior_evidence: timezone.value.special_behavior_evidence,
      zones: timezoneEntries,
    });

    const solarEntries = [];
    for (let year = 1969; year <= 2101; year += 1) {
      const records = solar.value.records.filter((record) => record.year === year);
      if (records.length !== 24) throw new Error(`SOLAR_YEAR_COUNT_MISMATCH:${year}`);
      const asset = writeJson(tempRoot, `solar/years/${year}.json`, {
        year,
        record_count: 24,
        source_dataset_id: solar.value.dataset_id,
        source_dataset_version: solar.value.version,
        source_dataset_sha256: expected.solar,
        records,
      });
      solarEntries.push({ year, ...asset });
    }
    const solarIndexAsset = writeJson(tempRoot, "solar/index.json", {
      dataset_id: solar.value.dataset_id,
      version: solar.value.version,
      status: "DERIVED_RUNTIME_INDEX",
      source_dataset_sha256: expected.solar,
      source_record_count: solar.value.record_count,
      coverage: solar.value.coverage,
      years: solarEntries,
    });

    const manifestAsset = writeJson(tempRoot, "manifest.json", {
      runtime_asset_version: "0.1",
      status: "DERIVED_RUNTIME_ASSETS",
      bazi_rules_protocol_id: rules.value.protocol_id,
      bazi_rules_version: rules.value.version,
      bazi_rules_sha256: expected.rules,
      solar_dataset_id: solar.value.dataset_id,
      solar_dataset_sha256: expected.solar,
      timezone_dataset_id: timezone.value.dataset_id,
      timezone_dataset_sha256: expected.timezone,
      location_registry_id: location.value.registry_id,
      location_registry_sha256: expected.location,
      generated_from_commit: sourceCommit,
      location_asset: locationAsset,
      timezone_index_asset: timezoneIndexAsset,
      solar_index_asset: solarIndexAsset,
      generation_policy: {
        frozen_assets_are_single_source_of_truth: true,
        deterministic_json: true,
        timezone_chunking: "ONE_ZONE_PER_ASSET",
        solar_chunking: "ONE_YEAR_PER_ASSET",
        network_sources: false,
      },
    });

    const maxZone = Math.max(...timezoneEntries.map((entry) => entry.byte_size));
    const maxSolar = Math.max(...solarEntries.map((entry) => entry.byte_size));
    const shanghai = timezoneEntries.find((entry) => entry.zone_id === "Asia/Shanghai");
    const typicalSolar = solarEntries.filter((entry) => entry.year >= 2023 && entry.year <= 2025).reduce((sum, entry) => sum + entry.byte_size, 0);
    const typicalBytes = manifestAsset.byte_size + locationAsset.byte_size + timezoneIndexAsset.byte_size + shanghai.byte_size + solarIndexAsset.byte_size + typicalSolar;
    if (typicalBytes >= 300_000) throw new Error(`TYPICAL_LOAD_TOO_LARGE:${typicalBytes}`);
    replaceAtomically(tempRoot, destination);
    return {
      output: destination,
      manifest_sha256: manifestAsset.sha256,
      timezone_chunk_count: timezoneEntries.length,
      solar_year_chunk_count: solarEntries.length,
      full_timezone_source_bytes: timezone.bytes.length,
      full_solar_source_bytes: solar.bytes.length,
      location_browser_bytes: locationAsset.byte_size,
      timezone_index_bytes: timezoneIndexAsset.byte_size,
      max_zone_chunk_bytes: maxZone,
      asia_shanghai_zone_bytes: shanghai.byte_size,
      max_solar_year_bytes: maxSolar,
      cn_mainland_2024_total_bytes: typicalBytes,
    };
  } catch (error) {
    if (existsSync(tempRoot)) rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

const summary = build(outputArgument());
for (const [key, value] of Object.entries(summary)) console.log(`${key.toUpperCase()}=${value}`);
