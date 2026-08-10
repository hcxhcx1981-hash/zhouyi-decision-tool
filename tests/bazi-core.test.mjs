import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  calculateCivilDay,
  gregorianOrdinalA,
  isGregorianLeapYear,
  julianDayNumberB,
  parseCivilDate,
} from "../src/lib/bazi/civil-day.ts";
import { loadFrozenBaziData } from "../src/lib/bazi/frozen-data-node.ts";
import { calculateBaziPillars } from "../src/lib/bazi/pillar-core.ts";
import {
  hourPillarForDayStem,
  monthPillarForYearStem,
  yearPillarForLichunYear,
} from "../src/lib/bazi/sexagenary-cycle.ts";

const root = resolve(import.meta.dirname, "..");
const fixturePath = join(root, "tests", "fixtures", "bazi_core_normalized_cases_v0.1.1.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const data = loadFrozenBaziData(root);

test("frozen loader exposes only the formal rule and solar-term runtime assets", () => {
  assert.equal(data.rulesProtocolId, "BAZI_CALENDAR_RULES_V0_1_1");
  assert.equal(data.rulesVersion, "0.1.1");
  assert.equal(data.datasetId, "BAZI_SOLAR_TERMS_1969_2101_V0_1_0");
  assert.equal(data.datasetVersion, "0.1.0");
  assert.equal(data.datasetSha256, "0e22ce7738ee0aedfb15056a3888959907a2e0b88b06ed2b54bce838fc5d5ea2");
  assert.equal(data.solarTerms.length, 3192);
  assert.ok(Object.isFrozen(data));
  assert.ok(Object.isFrozen(data.solarTerms));
});

test("sexagenary anchors, five-tiger, five-rat, and Zi-hour coupling are deterministic", () => {
  assert.equal(yearPillarForLichunYear(1984).text, "甲子");
  assert.equal(monthPillarForYearStem("甲", "寅").text, "丙寅");
  assert.equal(monthPillarForYearStem("癸", "丑").text, "乙丑");
  assert.equal(hourPillarForDayStem("甲", 23).text, "甲子");
  assert.equal(hourPillarForDayStem("乙", 0).text, "丙子");
  assert.equal(hourPillarForDayStem("甲", 22).text, "乙亥");
});

test("independent day ordinals agree for all 47,847 supported civil dates", () => {
  let count = 0;
  let cursor = new Date(Date.UTC(1970, 0, 1));
  const end = new Date(Date.UTC(2100, 11, 31));
  while (cursor <= end) {
    const value = cursor.toISOString().slice(0, 10);
    const parsed = parseCivilDate(value);
    assert.ok(parsed);
    assert.equal(gregorianOrdinalA(parsed), julianDayNumberB(parsed) - 1721120, value);
    assert.equal(calculateCivilDay(value)?.algorithmsAgree, true, value);
    count += 1;
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  assert.equal(count, 47_847);
});

test("2100 is not leap and civil midnight, not 23:00, selects the next day pillar", () => {
  assert.equal(isGregorianLeapYear(2100), false);
  assert.equal(calculateCivilDay("2100-02-28")?.pillar.text, "辛丑");
  assert.equal(calculateCivilDay("2100-03-01")?.pillar.text, "壬寅");
  assert.equal(calculateCivilDay("2024-05-20")?.pillar.text, "甲申");
  assert.equal(calculateCivilDay("2024-05-21")?.pillar.text, "乙酉");
  assert.equal(hourPillarForDayStem("甲", 23).text, "甲子");
  assert.equal(hourPillarForDayStem("乙", 0).text, "丙子");
});

test("all 70 frozen cases satisfy the Phase 2.2A acceptance counters", () => {
  const counters = {
    status: 0,
    pillars: 0,
    blocked: 0,
    assertionsOnly: 0,
    warnings: 0,
    threePillars: 0,
    sameMinute: 0,
  };

  const byId = new Map();
  for (const fixtureCase of fixture.cases) {
    const result = calculateBaziPillars(fixtureCase.normalized_input, data);
    const expected = fixtureCase.expected;
    byId.set(fixtureCase.source_case_id, { fixtureCase, result });

    if (expected.expected_blocking_code) {
      assert.equal(result.status, "BLOCKED", fixtureCase.source_case_id);
      assert.equal(result.blockingCode, expected.expected_blocking_code, fixtureCase.source_case_id);
      counters.blocked += 1;
      if (expected.expected_blocking_code === "SOLAR_TERM_SAME_MINUTE_AMBIGUOUS") {
        counters.sameMinute += 1;
      }
    } else {
      assert.equal(result.status, "READY", fixtureCase.source_case_id);
      assert.equal(result.blockingCode, null, fixtureCase.source_case_id);
    }
    counters.status += 1;

    if (expected.expected_pillars) {
      assert.deepEqual(
        {
          year: result.yearPillar?.text ?? null,
          month: result.monthPillar?.text ?? null,
          day: result.dayPillar?.text ?? null,
          hour: result.hourPillar?.text ?? null,
        },
        expected.expected_pillars,
        fixtureCase.source_case_id,
      );
      counters.pillars += 1;
    }

    if (expected.expected_completeness) {
      assert.equal(result.completeness, expected.expected_completeness, fixtureCase.source_case_id);
      counters.threePillars += 1;
    }

    if (expected.expected_warnings) {
      assert.deepEqual(result.warnings, expected.expected_warnings, fixtureCase.source_case_id);
      counters.warnings += 1;
    } else {
      assert.deepEqual(result.warnings, [], fixtureCase.source_case_id);
    }

    if (expected.expected_assertions && !expected.expected_pillars) {
      const assertions = expected.expected_assertions;
      if ("civil_date_valid" in assertions) {
        assert.equal(Boolean(parseCivilDate(fixtureCase.normalized_input.localDate)), assertions.civil_date_valid);
      }
      if (assertions.day_pillar) assert.equal(result.dayPillar?.text, assertions.day_pillar);
      if ("gregorian_leap_year" in assertions) {
        const year = Number(fixtureCase.normalized_input.localDate.slice(0, 4));
        assert.equal(isGregorianLeapYear(year), assertions.gregorian_leap_year);
      }
      if (assertions.birth_date_allowed) assert.equal(result.status, "READY");
      if (assertions.days_since_previous_case) {
        const previous = calculateCivilDay("2100-02-28");
        assert.equal(result.audit.dayAlgorithmAIndex - previous.algorithmAIndex, assertions.days_since_previous_case);
      }
      counters.assertionsOnly += 1;
    }

    if (expected.expected_assertions?.utc_offset) {
      assert.equal(
        fixtureCase.normalization_evidence.resolved_utc_offset,
        expected.expected_assertions.utc_offset,
        fixtureCase.source_case_id,
      );
    }
  }

  assert.deepEqual(counters, {
    status: 70,
    pillars: 39,
    blocked: 25,
    assertionsOnly: 6,
    warnings: 20,
    threePillars: 4,
    sameMinute: 12,
  });

  assert.equal(byId.get("BZ-C034-ZI-2300").result.dayPillar.text, "甲申");
  assert.equal(byId.get("BZ-C035-ZI-0059").result.dayPillar.text, "乙酉");
});

test("core source has no case-id, candidate-data, wall-clock, or fixture dependency", () => {
  const directory = join(root, "src", "lib", "bazi");
  const source = readdirSync(directory)
    .filter((name) => name.endsWith(".ts") && name !== "form.ts" && name !== "types.ts")
    .map((name) => readFileSync(join(directory, name), "utf8"))
    .join("\n");
  assert.doesNotMatch(source, /BZ-C/);
  assert.doesNotMatch(source, /research[\\/]/i);
  assert.doesNotMatch(source, /bazi_calendar_test_cases/i);
  assert.doesNotMatch(source, /bazi_core_normalized_cases/i);
  assert.doesNotMatch(source, /2024-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
  assert.doesNotMatch(source, /Math\.random|fetch\s*\(|https?:\/\//);
  assert.doesNotMatch(source, /Date\.now\s*\(|new Date\s*\(\s*\)/);
});
