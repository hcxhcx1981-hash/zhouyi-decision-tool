import fs from "node:fs";
import path from "node:path";

export interface CanonicalText {
  canonical_text: string;
  canonical_source_id: string;
}

export interface HexagramLine {
  line_order: number | null;
  is_special_line: boolean;
  line_label: string;
  line_text_canonical: string;
  small_image_canonical: string;
  canonical_source_id: string;
}

export interface HexagramContent {
  key: string;
  hexagram_id: number;
  name: string;
  name_pinyin: string;
  upper_trigram: string;
  lower_trigram: string;
  trigram_element: string;
  judgment: CanonicalText;
  tuan: CanonicalText;
  lines: HexagramLine[];
}

interface FrozenDataset {
  hexagrams: Omit<HexagramContent, "key">[];
}

const HEXAGRAM_KEYS: Record<number, string> = {
  1: "111111",
  2: "000000",
  3: "100010",
};

export function loadFrozenHexagrams(): HexagramContent[] {
  const filePath = path.join(
    process.cwd(),
    "data",
    "frozen",
    "02_乾坤屯_结构化_V0.3.1.json",
  );
  const dataset = JSON.parse(fs.readFileSync(filePath, "utf8")) as FrozenDataset;

  return dataset.hexagrams.map((hexagram) => ({
    key: HEXAGRAM_KEYS[hexagram.hexagram_id],
    hexagram_id: hexagram.hexagram_id,
    name: hexagram.name,
    name_pinyin: hexagram.name_pinyin,
    upper_trigram: hexagram.upper_trigram,
    lower_trigram: hexagram.lower_trigram,
    trigram_element: hexagram.trigram_element,
    judgment: {
      canonical_text: hexagram.judgment.canonical_text,
      canonical_source_id: hexagram.judgment.canonical_source_id,
    },
    tuan: {
      canonical_text: hexagram.tuan.canonical_text,
      canonical_source_id: hexagram.tuan.canonical_source_id,
    },
    lines: hexagram.lines.map((line) => ({
      line_order: line.line_order,
      is_special_line: line.is_special_line,
      line_label: line.line_label,
      line_text_canonical: line.line_text_canonical,
      small_image_canonical: line.small_image_canonical,
      canonical_source_id: line.canonical_source_id,
    })),
  }));
}

export function loadProtocolVersion(): string {
  const filePath = path.join(
    process.cwd(),
    "data",
    "frozen",
    "zhouyi_divination_rules_v0.1.json",
  );
  const rules = JSON.parse(fs.readFileSync(filePath, "utf8")) as { version: string };
  return `V${rules.version.replace(/\.0$/, "")}`;
}
