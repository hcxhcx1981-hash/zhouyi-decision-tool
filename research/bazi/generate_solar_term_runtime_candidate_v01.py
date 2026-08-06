from __future__ import annotations

import argparse
import importlib.metadata
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import astronomy


RESEARCH = Path(__file__).resolve().parent
SPEC_PATH = RESEARCH / "solar_term_runtime_dataset_spec_candidate_v0.1.json"
DEFAULT_OUTPUT = RESEARCH / "solar_terms_1969_2101.candidate.json"

START_YEAR = 1969
END_YEAR = 2101
EXPECTED_VERSION = "2.1.19"
GENERATOR_SOURCE_ID = "GEN-ASTRONOMY-ENGINE-2.1.19"
OFFICIAL_MINUTE_START_YEAR = 2009
OFFICIAL_MINUTE_END_YEAR = 2027


def load_spec() -> dict[str, Any]:
    with SPEC_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def validate_registry(spec: dict[str, Any]) -> list[dict[str, Any]]:
    registry = sorted(spec["term_registry"], key=lambda item: item["order"])
    if len(registry) != 24:
        raise ValueError(f"term_registry必须为24条，实际{len(registry)}")
    if [item["order"] for item in registry] != list(range(1, 25)):
        raise ValueError("term_registry.order必须严格为1—24")
    if len({item["term_id"] for item in registry}) != 24:
        raise ValueError("term_registry.term_id存在重复")
    if sum(bool(item["is_month_boundary_jie"]) for item in registry) != 12:
        raise ValueError("term_registry必须包含12个节")
    if sum(bool(item["is_middle_qi"]) for item in registry) != 12:
        raise ValueError("term_registry必须包含12个中气")
    for index, item in enumerate(registry):
        expected_longitude = (285 + index * 15) % 360
        if item["solar_longitude_degrees"] != expected_longitude:
            raise ValueError(
                f"{item['term_id']}黄经错误: {item['solar_longitude_degrees']} != {expected_longitude}"
            )
        if bool(item["is_month_boundary_jie"]) == bool(item["is_middle_qi"]):
            raise ValueError(f"{item['term_id']}的节/中气标志必须互斥")
        if item["is_month_boundary_jie"] and not item["corresponding_branch"]:
            raise ValueError(f"{item['term_id']}缺少月支边界映射")
        if item["is_middle_qi"] and item["corresponding_branch"] is not None:
            raise ValueError(f"{item['term_id']}中气不得携带月支边界")
    return registry


def truncate_to_whole_second(value: datetime) -> str:
    """舍去亚秒，不四舍五入；与既有456条生成时刻矩阵口径一致。"""
    return value.replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def generate_records(registry: list[dict[str, Any]]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for year in range(START_YEAR, END_YEAR + 1):
        cursor = astronomy.Time.Make(year, 1, 1, 0, 0, 0)
        for item in registry:
            found = astronomy.SearchSunLongitude(
                float(item["solar_longitude_degrees"]), cursor, 25.0
            )
            if found is None:
                raise RuntimeError(f"未找到节气: year={year} term_id={item['term_id']}")
            utc_value = found.Utc()
            if utc_value.year != year:
                raise RuntimeError(
                    f"节气年份归类错误: year={year} term_id={item['term_id']} instant={utc_value}"
                )
            officially_crosschecked = OFFICIAL_MINUTE_START_YEAR <= year <= OFFICIAL_MINUTE_END_YEAR
            records.append(
                {
                    "year": year,
                    "term_id": item["term_id"],
                    "term_name_zh": item["term_name_zh"],
                    "order": item["order"],
                    "solar_longitude_degrees": item["solar_longitude_degrees"],
                    "is_month_boundary_jie": item["is_month_boundary_jie"],
                    "is_zhongqi": item["is_middle_qi"],
                    "month_branch_after_boundary": item["corresponding_branch"],
                    "instant_utc": truncate_to_whole_second(utc_value),
                    "generator_source_id": GENERATOR_SOURCE_ID,
                    "generator_version": EXPECTED_VERSION,
                    "timestamp_resolution": "second",
                    "verification_status": (
                        "OFFICIAL_MINUTE_CROSSCHECK_AVAILABLE"
                        if officially_crosschecked
                        else "GENERATOR_ONLY_NOT_OFFICIALLY_CROSSCHECKED"
                    ),
                    "verification_source_ids": (
                        ["SRC-NAOJ-SOLAR-TERM"] if officially_crosschecked else []
                    ),
                }
            )
            # 下一目标黄经相差15°；从当前时刻后0.5天继续搜索，避免重复命中。
            cursor = found.AddDays(0.5)
    return records


def build_dataset(spec: dict[str, Any]) -> dict[str, Any]:
    installed_version = importlib.metadata.version("astronomy-engine")
    if installed_version != EXPECTED_VERSION:
        raise RuntimeError(
            f"astronomy-engine版本不符: {installed_version} != {EXPECTED_VERSION}"
        )
    registry = validate_registry(spec)
    records = generate_records(registry)
    return {
        "dataset_id": "BAZI_SOLAR_TERMS_1969_2101_CANDIDATE_V0_1",
        "version": "0.1.0-candidate",
        "status": "CANDIDATE_NOT_FOR_RUNTIME",
        "coverage": {
            "start_year": START_YEAR,
            "end_year": END_YEAR,
            "year_count": END_YEAR - START_YEAR + 1,
        },
        "record_count": len(records),
        "time_standard": "UTC",
        "generator": {
            "source_id": GENERATOR_SOURCE_ID,
            "package": "astronomy-engine",
            "version": EXPECTED_VERSION,
        },
        "generation_policy": {
            "algorithm": "按spec登记的太阳视黄经顺序调用SearchSunLongitude",
            "year_assignment": "按每个公历年1月1日UTC起顺序搜索24个节气",
            "second_rounding": "TRUNCATE_SUBSECOND_TOWARD_EARLIER_WHOLE_SECOND",
            "serialization": "UTF-8_NO_BOM_LF_INDENT_2_TRAILING_NEWLINE",
            "network_at_generation_runtime": False,
            "online_api_used": False,
        },
        "precision_policy": {
            "timestamp_resolution": "second",
            "subsecond_policy": "TRUNCATE_SUBSECOND_TOWARD_EARLIER_WHOLE_SECOND",
            "official_crosscheck_resolution": "minute",
            "second_level_accuracy_claim": False,
            "accuracy_statement": "时间戳保存到整秒，但不声称具有官方秒级准确度；官方逐条核验源为分钟显示。",
        },
        "term_registry_version": "0.1.0",
        "verification_status": "PENDING_FULL_AUDIT",
        "known_limitations": [
            "这是候选数据，不是正式运行数据，不得接入应用。",
            "官方分钟级逐条核验仅覆盖2009—2027共456条。",
            "1969—2008与2028—2101仅由固定生成器产生，尚无官方逐条核验。",
            "时间戳保存到整秒，但不声称具有官方秒级准确度；NAOJ核验源只提供分钟级显示且舍入规则未知。",
        ],
        "records": records,
    }


def write_stable_json(output: Path, dataset: dict[str, Any]) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(dataset, ensure_ascii=False, indent=2) + "\n"
    with output.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(payload)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="使用Astronomy Engine 2.1.19生成1969—2101完整节气候选数据。"
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--overwrite-candidate",
        action="store_true",
        help="仅允许覆盖文件名以.candidate.json结尾的候选输出。",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output = args.output.resolve()
    if output.exists() and not args.overwrite_candidate:
        print(f"拒绝覆盖已有文件: {output}", file=sys.stderr)
        return 2
    if args.overwrite_candidate and not output.name.endswith(".candidate.json"):
        print("--overwrite-candidate只能用于.candidate.json候选文件", file=sys.stderr)
        return 2
    try:
        dataset = build_dataset(load_spec())
        if dataset["record_count"] != 3192:
            raise RuntimeError(f"记录数错误: {dataset['record_count']} != 3192")
        write_stable_json(output, dataset)
    except Exception as error:
        print(f"生成失败: {error}", file=sys.stderr)
        return 1
    print(f"GENERATED={output}")
    print(f"RECORDS={dataset['record_count']}")
    print(f"GENERATOR_VERSION={dataset['generator']['version']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
