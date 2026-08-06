from __future__ import annotations

import calendar
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any


RESEARCH = Path(__file__).resolve().parent
DATASET_PATH = RESEARCH / "solar_terms_1969_2101.candidate.json"
HASH_PATH = RESEARCH / "solar_terms_1969_2101.candidate.json.sha256"
SPEC_PATH = RESEARCH / "solar_term_runtime_dataset_spec_candidate_v0.1.json"
MATRIX_PATH = RESEARCH / "solar_term_validation_matrix_v0.1.json"
REPORT_PATH = RESEARCH / "SOLAR_TERM_RUNTIME_CANDIDATE_GENERATION_REPORT_V0.1.md"
RULES_PATH = RESEARCH / "bazi_calendar_rules_candidate_v0.1.json"
LOCK_PATH = RESEARCH / "requirements-solar-term-generator.lock.txt"
NOTICES_PATH = RESEARCH / "THIRD_PARTY_NOTICES_SOLAR_TERM.md"

OLD_CANDIDATE_SHA256 = "8942f65a364f05c8e8fd09b40c18357c4d7610c978770f73bd64220f647ff5b5"
BASELINE_INSTANT_SEQUENCE_SHA256 = "deb6ca5dfc82a9ece6a3b1021ce9477d9e5044576c099b067d240c1a9e5858e4"
EXPECTED_LOCK_LINE = (
    "astronomy-engine==2.1.19 "
    "--hash=sha256:232ba7dd2bbf42225c48be6721b676e8c6c079dbd4588d2781dfa68adcb6f67f"
)
EXPECTED_MIT_LICENSE = """MIT License

Copyright (c) 2019-2022 Don Cross <cosinekitty@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE."""

ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
SPECIAL_YEARS = (1969, 1970, 1988, 2000, 2009, 2024, 2027, 2099, 2100, 2101)
REQUIRED_RECORD_FIELDS = {
    "year",
    "term_id",
    "term_name_zh",
    "order",
    "solar_longitude_degrees",
    "is_month_boundary_jie",
    "is_zhongqi",
    "month_branch_after_boundary",
    "instant_utc",
    "generator_source_id",
    "generator_version",
    "timestamp_resolution",
    "verification_status",
    "verification_source_ids",
}
FORBIDDEN_RUNTIME_DETAIL_FIELDS = {
    "authoritative_instant_utc",
    "actual_offset_from_reported_minute_seconds",
    "absolute_offset_from_reported_minute_seconds",
    "minute_label_delta",
    "comparison_status",
    "pass",
    "notes",
    "manually_verified",
    "production_ready",
    "source_precision",
    "second_level_verified",
    "official_second_accuracy",
}


class Audit:
    def __init__(self) -> None:
        self.failures: list[str] = []
        self.passes = 0

    def check(self, name: str, condition: bool, detail: str = "") -> None:
        if condition:
            self.passes += 1
            print(f"[PASS] {name}" + (f" — {detail}" if detail else ""))
        else:
            self.failures.append(name + (f": {detail}" if detail else ""))
            print(f"[FAIL] {name}" + (f" — {detail}" if detail else ""))


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def parse_utc(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def instant_sequence_sha256(records: list[dict[str, Any]]) -> str:
    sequence = [
        {"year": record.get("year"), "term_id": record.get("term_id"), "instant_utc": record.get("instant_utc")}
        for record in records
    ]
    payload = (json.dumps(sequence, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def count_key(value: Any, target: str) -> int:
    if isinstance(value, dict):
        return sum((1 if key == target else 0) + count_key(item, target) for key, item in value.items())
    if isinstance(value, list):
        return sum(count_key(item, target) for item in value)
    return 0


def interval_stats(values: list[float]) -> tuple[float, float, float]:
    return min(values), max(values), mean(values)


def main() -> int:
    audit = Audit()
    try:
        dataset = load_json(DATASET_PATH)
        spec = load_json(SPEC_PATH)
        matrix = load_json(MATRIX_PATH)
        rules = load_json(RULES_PATH)
    except Exception as error:
        print(f"[FAIL] 读取JSON: {error}")
        return 1

    records = dataset.get("records", [])
    registry = sorted(spec["term_registry"], key=lambda item: item["order"])
    registry_by_id = {item["term_id"]: item for item in registry}
    expected_ids = [item["term_id"] for item in registry]
    expected_years = list(range(1969, 2102))

    audit.check("dataset_id", dataset.get("dataset_id") == "BAZI_SOLAR_TERMS_1969_2101_CANDIDATE_V0_1")
    audit.check("候选状态", dataset.get("status") == "CANDIDATE_NOT_FOR_RUNTIME")
    audit.check("候选版本", dataset.get("version") == "0.1.0-candidate")
    audit.check("时间标准UTC", dataset.get("time_standard") == "UTC")
    audit.check("顶层核验状态未冒充正式通过", dataset.get("verification_status") == "PENDING_FULL_AUDIT")
    audit.check("生成器版本固定", dataset.get("generator") == {
        "source_id": "GEN-ASTRONOMY-ENGINE-2.1.19",
        "package": "astronomy-engine",
        "version": "2.1.19",
    })
    audit.check("登记表版本固定", dataset.get("term_registry_version") == "0.1.0")
    generation_policy = dataset.get("generation_policy", {})
    audit.check(
        "生成政策明确离线与整秒规则",
        generation_policy.get("second_rounding") == "TRUNCATE_SUBSECOND_TOWARD_EARLIER_WHOLE_SECOND"
        and generation_policy.get("network_at_generation_runtime") is False
        and generation_policy.get("online_api_used") is False,
    )
    precision_policy = dataset.get("precision_policy", {})
    audit.check(
        "精度协议不把整秒分辨率冒充官方秒级准确度",
        precision_policy == {
            "timestamp_resolution": "second",
            "subsecond_policy": "TRUNCATE_SUBSECOND_TOWARD_EARLIER_WHOLE_SECOND",
            "official_crosscheck_resolution": "minute",
            "second_level_accuracy_claim": False,
            "accuracy_statement": "时间戳保存到整秒，但不声称具有官方秒级准确度；官方逐条核验源为分钟显示。",
        },
    )
    raw_bytes = DATASET_PATH.read_bytes()
    stable_bytes = (json.dumps(dataset, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    audit.check(
        "稳定UTF-8/LF序列化",
        raw_bytes == stable_bytes
        and not raw_bytes.startswith(b"\xef\xbb\xbf")
        and b"\r" not in raw_bytes
        and raw_bytes.endswith(b"\n")
        and not raw_bytes.endswith(b"\n\n"),
    )

    actual_years = sorted({r.get("year") for r in records if isinstance(r.get("year"), int)})
    audit.check("年份覆盖1969—2101", actual_years == expected_years, f"years={len(actual_years)}")
    audit.check("年份数量重新计算为133", len(actual_years) == 133)
    audit.check("记录数量重新计算为3192", len(records) == 3192, f"records={len(records)}")
    audit.check("顶层record_count与重算一致", dataset.get("record_count") == len(records))
    audit.check("coverage与重算一致", dataset.get("coverage") == {
        "start_year": 1969,
        "end_year": 2101,
        "year_count": 133,
    })

    by_year: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        if isinstance(record.get("year"), int):
            by_year[record["year"]].append(record)
    bad_year_counts = {year: len(by_year[year]) for year in expected_years if len(by_year[year]) != 24}
    audit.check("每年正好24条", not bad_year_counts, str(list(bad_year_counts.items())[:3]))

    missing_fields = []
    extra_forbidden = []
    bad_term_sets = []
    bad_orders = []
    semantic_errors = []
    verification_errors = []
    parsed_times: list[datetime] = []
    bad_iso = []
    year_assignment_errors = []
    timestamp_resolution_pass = 0
    for year in expected_years:
        year_records = by_year[year]
        ids = [r.get("term_id") for r in year_records]
        orders = [r.get("order") for r in year_records]
        if sorted(ids) != sorted(expected_ids) or len(set(ids)) != 24:
            bad_term_sets.append(year)
        if orders != list(range(1, 25)) or len(set(orders)) != 24:
            bad_orders.append(year)
        for record in year_records:
            missing = REQUIRED_RECORD_FIELDS - set(record)
            if missing:
                missing_fields.append((year, record.get("term_id"), sorted(missing)))
            forbidden = FORBIDDEN_RUNTIME_DETAIL_FIELDS & set(record)
            if forbidden:
                extra_forbidden.append((year, record.get("term_id"), sorted(forbidden)))
            term = registry_by_id.get(record.get("term_id"))
            if term is None:
                semantic_errors.append((year, record.get("term_id"), "unknown_term"))
                continue
            expected_semantics = {
                "term_name_zh": term["term_name_zh"],
                "order": term["order"],
                "solar_longitude_degrees": term["solar_longitude_degrees"],
                "is_month_boundary_jie": term["is_month_boundary_jie"],
                "is_zhongqi": term["is_middle_qi"],
                "month_branch_after_boundary": term["corresponding_branch"],
            }
            for field, expected in expected_semantics.items():
                if record.get(field) != expected:
                    semantic_errors.append((year, record.get("term_id"), field))
            if record.get("generator_source_id") != "GEN-ASTRONOMY-ENGINE-2.1.19" or record.get("generator_version") != "2.1.19":
                semantic_errors.append((year, record.get("term_id"), "generator_metadata"))
            if record.get("timestamp_resolution") == "second":
                timestamp_resolution_pass += 1
            else:
                semantic_errors.append((year, record.get("term_id"), "timestamp_resolution"))

            official = 2009 <= year <= 2027
            expected_status = "OFFICIAL_MINUTE_CROSSCHECK_AVAILABLE" if official else "GENERATOR_ONLY_NOT_OFFICIALLY_CROSSCHECKED"
            expected_sources = ["SRC-NAOJ-SOLAR-TERM"] if official else []
            if record.get("verification_status") != expected_status or record.get("verification_source_ids") != expected_sources:
                verification_errors.append((year, record.get("term_id")))

            value = record.get("instant_utc", "")
            if not isinstance(value, str) or not ISO_RE.fullmatch(value):
                bad_iso.append((year, record.get("term_id"), value))
                continue
            try:
                instant = parse_utc(value)
                parsed_times.append(instant)
                if instant.year != year:
                    year_assignment_errors.append((year, record.get("term_id"), value))
            except ValueError:
                bad_iso.append((year, record.get("term_id"), value))

    audit.check("记录Schema完整", not missing_fields, str(missing_fields[:3]))
    audit.check("不含差分明细或正式标志字段", not extra_forbidden, str(extra_forbidden[:3]))
    source_precision_count = count_key(dataset, "source_precision")
    audit.check("source_precision字段数量为0", source_precision_count == 0, f"count={source_precision_count}")
    audit.check(
        "timestamp_resolution为second",
        timestamp_resolution_pass == 3192,
        f"pass={timestamp_resolution_pass}/3192",
    )
    audit.check("每年24个term_id唯一且齐全", not bad_term_sets, str(bad_term_sets[:3]))
    audit.check("每年order严格为1—24", not bad_orders, str(bad_orders[:3]))
    audit.check("黄经、节/中气与月支语义来自spec", not semantic_errors, str(semantic_errors[:3]))
    audit.check("官方核验状态边界正确", not verification_errors, str(verification_errors[:3]))
    audit.check("UTC Z格式与解析", not bad_iso and len(parsed_times) == 3192, f"valid={len(parsed_times)}")
    audit.check("无跨年归类错误", not year_assignment_errors, str(year_assignment_errors[:3]))

    order_errors = sum(1 for left, right in zip(parsed_times, parsed_times[1:]) if right <= left)
    duplicate_count = len(parsed_times) - len(set(parsed_times))
    audit.check("真实UTC严格递增", order_errors == 0, f"errors={order_errors}")
    audit.check("无重复UTC", duplicate_count == 0, f"duplicates={duplicate_count}")
    audit.check("首尾记录存在", bool(records) and records[0].get("year") == 1969 and records[0].get("term_id") == "XIAOHAN" and records[-1].get("year") == 2101 and records[-1].get("term_id") == "DONGZHI")

    longitude_errors = []
    for left, right in zip(records, records[1:]):
        expected = (left["solar_longitude_degrees"] + 15) % 360
        if right["solar_longitude_degrees"] != expected:
            longitude_errors.append((left["year"], left["term_id"], right["term_id"]))
    audit.check("黄经按15度循环", not longitude_errors, str(longitude_errors[:3]))
    audit.check("每年十二个节准确", all(sum(bool(r["is_month_boundary_jie"]) for r in by_year[y]) == 12 for y in expected_years))
    audit.check("每年十二个中气准确", all(sum(bool(r["is_zhongqi"]) for r in by_year[y]) == 12 for y in expected_years))
    audit.check("立春每年唯一", all(sum(r["term_id"] == "LICHUN" for r in by_year[y]) == 1 for y in expected_years))
    audit.check("小寒每年唯一", all(sum(r["term_id"] == "XIAOHAN" for r in by_year[y]) == 1 for y in expected_years))

    all_intervals = [(right - left).total_seconds() / 86400 for left, right in zip(parsed_times, parsed_times[1:])]
    jie_times = [parse_utc(r["instant_utc"]) for r in records if r["is_month_boundary_jie"]]
    jie_intervals = [(right - left).total_seconds() / 86400 for left, right in zip(jie_times, jie_times[1:])]
    all_min, all_max, all_avg = interval_stats(all_intervals)
    jie_min, jie_max, jie_avg = interval_stats(jie_intervals)
    audit.check("全部相邻24节气间隔在PROVISIONAL 13—17天", all(13 <= value <= 17 for value in all_intervals), f"min={all_min:.6f} max={all_max:.6f}")
    audit.check("相邻十二节间隔在PROVISIONAL 29—32天", all(29 <= value <= 32 for value in jie_intervals), f"min={jie_min:.6f} max={jie_max:.6f}")

    candidate_map = {(r["year"], r["term_id"]): r["instant_utc"] for r in records}
    matrix_mismatches = []
    for row in matrix["records"]:
        key = (row["year"], row["term_id"])
        if candidate_map.get(key) != row["generated_instant_utc"]:
            matrix_mismatches.append((key, candidate_map.get(key), row["generated_instant_utc"]))
    audit.check("2009—2027既有456条生成时刻一致", len(matrix["records"]) == 456 and not matrix_mismatches, f"matches={456-len(matrix_mismatches)}/456")
    official_count = sum(r["verification_status"] == "OFFICIAL_MINUTE_CROSSCHECK_AVAILABLE" for r in records)
    generator_only_count = sum(r["verification_status"] == "GENERATOR_ONLY_NOT_OFFICIALLY_CROSSCHECKED" for r in records)
    audit.check("外部核验覆盖数量正确", official_count == 456 and generator_only_count == 2736, f"official={official_count} generator_only={generator_only_count}")

    instant_fingerprint = instant_sequence_sha256(records)
    audit.check(
        "旧候选与新候选3192条instant_utc完全一致",
        len(records) == 3192 and instant_fingerprint == BASELINE_INSTANT_SEQUENCE_SHA256,
        f"matches={3192 if instant_fingerprint == BASELINE_INSTANT_SEQUENCE_SHA256 else 0}/3192 fingerprint={instant_fingerprint}",
    )

    actual_hash = sha256_file(DATASET_PATH)
    try:
        hash_line = HASH_PATH.read_text(encoding="ascii").strip()
        expected_hash, expected_name = hash_line.split("  ", 1)
        hash_ok = expected_hash == actual_hash and expected_name == DATASET_PATH.name
    except Exception:
        hash_ok = False
    audit.check("SHA-256文件匹配候选JSON", hash_ok, actual_hash)

    report = REPORT_PATH.read_text(encoding="utf-8") if REPORT_PATH.is_file() else ""
    old_hash = re.search(r"OLD_CANDIDATE_SHA256\s*=\s*([0-9a-f]{64})", report)
    new_hash = re.search(r"NEW_CANDIDATE_SHA256\s*=\s*([0-9a-f]{64})", report)
    run_a = re.search(r"RUN_A_SHA256\s*=\s*([0-9a-f]{64})", report)
    run_b = re.search(r"RUN_B_SHA256\s*=\s*([0-9a-f]{64})", report)
    reproducible = bool(
        old_hash and old_hash.group(1) == OLD_CANDIDATE_SHA256
        and new_hash and new_hash.group(1) == actual_hash
        and run_a and run_b and run_a.group(1) == run_b.group(1) == actual_hash
        and "BYTE_IDENTICAL = PASS" in report
        and "INSTANT_UTC_MATCHES = 3192/3192" in report
    )
    audit.check("run-A/run-B新JSON字节一致且旧新时刻证据完整", reproducible)

    try:
        lock_lines = LOCK_PATH.read_text(encoding="ascii").splitlines()
    except Exception:
        lock_lines = []
    audit.check("requirements锁文件存在且仅含固定依赖", lock_lines == [EXPECTED_LOCK_LINE])
    audit.check(
        "依赖版本与官方wheel SHA-256正确",
        lock_lines == [EXPECTED_LOCK_LINE]
        and "astronomy-engine==2.1.19" in lock_lines[0]
        and "232ba7dd2bbf42225c48be6721b676e8c6c079dbd4588d2781dfa68adcb6f67f" in lock_lines[0],
    )

    notices = NOTICES_PATH.read_text(encoding="utf-8") if NOTICES_PATH.is_file() else ""
    audit.check("THIRD_PARTY_NOTICES存在", NOTICES_PATH.is_file())
    audit.check(
        "Astronomy Engine 2.1.19完整MIT正文存在",
        EXPECTED_MIT_LICENSE in notices
        and "https://github.com/cosinekitty/astronomy" in notices
        and "`astronomy-engine`" in notices,
    )

    runtime_rule = next(
        (item for item in rules.get("implementation_dependencies", {}).get("rules", [])
         if item.get("rule_id") == "SOLAR-TERM-RUNTIME-DATASET-001"),
        None,
    )
    audit.check(
        "SOLAR-TERM-RUNTIME-DATASET-001为PROPOSED_FREEZE",
        runtime_rule is not None and runtime_rule.get("status") == "PROPOSED_FREEZE",
    )
    audit.check(
        "blocking_behavior仍为SOLAR_TERM_RUNTIME_DATASET_NOT_FROZEN",
        runtime_rule is not None
        and runtime_rule.get("blocking_behavior") == "SOLAR_TERM_RUNTIME_DATASET_NOT_FROZEN",
    )

    serialized = json.dumps(dataset, ensure_ascii=False).lower()
    record_keys = {key for record in records for key in record}
    private_keys = {"name", "birth_date", "birthday", "user_id", "email", "phone", "location_name"}
    secret_pattern = re.compile(r"(api[_-]?key|access[_-]?token|cookie|password)\s*[:=]")
    audit.check("不含真实用户字段", not (record_keys & private_keys))
    audit.check("不含正式域名", "http://" not in serialized and "https://" not in serialized)
    audit.check("不含API Key、Token或Cookie", secret_pattern.search(serialized) is None)
    audit.check("不含ACTIVE/FROZEN/production_ready", all(token not in serialized for token in ('"active"', '"frozen"', 'production_ready')))
    audit.check(
        "候选未宣称应用已接入",
        runtime_rule is not None
        and "应用已接入" not in json.dumps(runtime_rule, ensure_ascii=False)
        and "应用已接入" not in report
        and "运行时已接入" not in report,
    )

    for year in SPECIAL_YEARS:
        values = {r["term_id"]: r["instant_utc"] for r in by_year[year]}
        normal_order = [r["order"] for r in by_year[year]] == list(range(1, 25))
        if year == 1969:
            cross_year = "N/A_DATASET_START"
        else:
            previous_winter = parse_utc(by_year[year - 1][-1]["instant_utc"])
            current_cold = parse_utc(by_year[year][0]["instant_utc"])
            cross_days = (current_cold - previous_winter).total_seconds() / 86400
            cross_year = "PASS" if 13 <= cross_days <= 17 else "FAIL"
        print(
            f"SPECIAL_YEAR={year} records={len(by_year[year])} "
            f"XIAOHAN={values.get('XIAOHAN')} LICHUN={values.get('LICHUN')} "
            f"XIAZHI={values.get('XIAZHI')} DONGZHI={values.get('DONGZHI')} "
            f"order={'PASS' if normal_order else 'FAIL'} cross_year={cross_year}"
        )

    audit.check("特殊年份均24条且顺序正常", all(len(by_year[y]) == 24 and [r["order"] for r in by_year[y]] == list(range(1, 25)) for y in SPECIAL_YEARS))
    audit.check("2100不是闰年且仍有24条", calendar.isleap(2100) is False and len(by_year[2100]) == 24)

    print(f"RECORDS_PASS={len(records) - len(missing_fields) - len(semantic_errors)}/{len(records)}")
    print(f"UTC_FORMAT_PASS={len(parsed_times)}/{len(records)}")
    print(f"MATRIX_INSTANT_MATCHES={456-len(matrix_mismatches)}/456")
    print(f"BASELINE_INSTANT_MATCHES={3192 if instant_fingerprint == BASELINE_INSTANT_SEQUENCE_SHA256 else 0}/3192")
    print(f"SOURCE_PRECISION_COUNT={source_precision_count}")
    print(f"TIMESTAMP_RESOLUTION_PASS={timestamp_resolution_pass}/3192")
    print(f"SECOND_LEVEL_ACCURACY_CLAIM={precision_policy.get('second_level_accuracy_claim')}")
    print(f"ALL24_INTERVAL_DAYS=min:{all_min:.9f},max:{all_max:.9f},avg:{all_avg:.9f}")
    print(f"TWELVE_JIE_INTERVAL_DAYS=min:{jie_min:.9f},max:{jie_max:.9f},avg:{jie_avg:.9f}")
    print(f"DUPLICATE_UTC={duplicate_count}")
    print(f"ORDER_ERRORS={order_errors}")
    print(f"SHA256={actual_hash}")
    print(f"RESULT={audit.passes} PASS / {len(audit.failures)} FAIL")
    if audit.failures:
        print("SOLAR_TERM_RUNTIME_CANDIDATE_VALIDATION: FAIL")
        return 1
    print("SOLAR_TERM_RUNTIME_CANDIDATE_VALIDATION: ALL PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
