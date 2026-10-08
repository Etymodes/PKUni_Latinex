#!/usr/bin/env python3
"""Extract the user's 230-page N1 list without modifying the source PDF.

Requires the existing bundled pdfplumber runtime. Optional PNG review uses
pypdfium2; neither package is installed by this script. Run --help for paths.
The output deliberately omits CFGM levels pending individual assessment.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re
import unicodedata

import pdfplumber

REPO = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path("D:/Etymodes/日语/已处理/词汇/N1必背2000词PDF.pdf")
SOURCE_SHA256 = "2f8b65adb45c9d90a2dbcf06a75b86195e27c68c1d36227ee0212afaa54c5ac3"
POS = re.compile(r"^［([^］]+)］\s*(.*)$")
PITCH = re.compile(r"[⓪①②③④⑤⑥⑦⑧⑨⑩⑪⑫]+")
FOOTER = re.compile(r"^·\s*\d+\s*·$")
SUPPLEMENT = re.compile(r"^[連関類対合慣諺]\s")
KANA = re.compile(r"^[ぁ-ゖァ-ヺーゝゞヽヾ]+$")
BASE_NOTE = "释义取自用户提供的《N1必背2000词PDF》，保留原资料词义范围；CFGM 等级待逐词评估。"

# Auditable editorial fixes are keyed by PDF page and the complete printed
# header without pitch/whitespace. The raw PDF reading/meaning remain in the
# audit file, and every fix is described in the output notes and report.
CORRECTIONS: dict[tuple[int, str], dict] = {
    (58, "ためし【試し】"): {
        "gloss": "尝试，试验",
        "note": "原 PDF 的「前例」对应同音词「例（ためし）」，与所印「試し」错配；本条保留印刷词头并订正词义。原作者意图采用哪个词头无法仅据此页确定。",
        "sources": ["https://kotobank.jp/word/試し-563054",
                    "https://dictionary.goo.ne.jp/word/ためし/"],
    },
    (98, "よこづな【横綱】"): {
        "gloss": "横纲（相扑力士的最高等级）",
        "note": "原释义「相扑冠军」不够准确；横纲是力士等级，订正为最高等级称号。",
        "sources": ["https://sumo.or.jp/Entertainment/quiz/93"],
    },
    (112, "かなえる【適える／叶える】"): {
        "lemma": "叶える",
        "note": "原并列词头为「適える／叶える」；所给「实现」义和原搭配「願いを叶える」采用「叶える」作主词头，另式保留。",
    },
    (117, "さく【裂く／割く】"): {
        "gloss": "（裂く）撕开，切开、劈开；（割く）分出，匀出",
        "note": "按原资料两个搭配区分写法义项：紙を裂く／時間を割く。",
    },
    (131, "てっする【徹する】"): {
        "gloss": "贯彻到底，专心于；彻夜；穿透",
        "partOfSpeech": "サ变自他动词",
        "note": "原 PDF 将「撤する」的撤回义和例句配给了「徹する」；本条保留印刷词头徹する并按词典订正。原作者意图采用哪个词头无法仅据此页确定，原例句不导入。",
        "sources": ["https://kotobank.jp/word/徹する-576214",
                    "https://dictionary.goo.ne.jp/word/てっする/"],
    },
    (138, "なつく【懐く】"): {
        "gloss": "亲近，依恋；驯服，亲人",
        "partOfSpeech": "五段自动词",
        "note": "原释义「抱有，怀有」及他动词标签与なつく错配；原例句「親になつかない子」支持亲近义，故订正释义与词性。",
        "sources": ["https://kotobank.jp/word/懐く-588749"],
    },
    (161, "かなわない【適わない】"): {
        "partOfSpeech": "惯用表达（动词否定式）",
        "note": "原 PDF 词性标为「イ形」；词典将「かなわない」列为连语，保留否定式词头以保住所教惯用义。",
        "sources": ["https://kotobank.jp/word/適わない-465214"],
    },
    (174, "きゃしゃな【華奢な】"): {
        "gloss": "纤细秀气的；（构造）单薄、不结实的",
        "note": "原释义「奢华的，奢侈的」与读音きゃしゃ不对应，更接近かしゃ；本条按所列きゃしゃ订正。原文留在提取审计文件。",
        "sources": ["https://dictionary.goo.ne.jp/word/華奢_(きゃしゃ)/",
                    "https://www.kanjipedia.jp/kotoba/0000684900"],
    },
    (194, "いやに【嫌に】"): {
        "gloss": "非常，极其",
        "note": "原释义「非常，及其」中的中文笔误订正为「极其」。",
    },
    (201, "とうてい【到底】"): {
        "gloss": "无论如何也（后接否定）",
        "note": "原释义「如论如何也」中的中文笔误订正为「无论如何也」。",
    },
    (214, "カルテ(Karte)"): {
        "gloss": "病历；诊疗记录",
        "note": "原释义「病例」订正为记录意义的「病历」。",
        "sources": ["https://kotobank.jp/word/かるて-3147984"],
    },
    (217, "シックな(〈法〉chic)"): {
        "partOfSpeech": "な形容词",
        "note": "原 PDF 标为「名」但词头为シックな；规范词头为シック，按原词头实际用法标な形容词。",
    },
    (222, "デジタル(digital)"): {
        "gloss": "数字式；数字化的",
        "partOfSpeech": "名词・な形容词",
        "note": "原释义「技术化的，智能的」未准确表达 digital，按词典核心义订正。",
        "sources": ["https://kotobank.jp/word/でじたる-3199189"],
    },
    (223, "ノイローゼ(Neurose)"): {
        "gloss": "神经症；（口语）精神紧张、精神失调",
        "note": "原释义「神经病，神经衰弱」容易混淆，按词典区分神经症与日常口语意义。",
        "sources": ["https://kotobank.jp/jeword/ノイローゼ"],
    },
    (224, "パック(pack)"): {
        "gloss": "包装，包；面膜，敷面美容",
        "note": "原释义含「润肤膏」，美容义按词典明确为面膜、敷面美容。",
        "sources": ["https://kotobank.jp/word/ぱつく-3164792"],
    },
    (227, "マッサージ(massage)"): {
        "gloss": "按摩",
        "partOfSpeech": "名词・サ变他动词",
        "note": "原释义「按摩，桑拿」中的桑拿并非此词义，删去；原文保留在提取审计文件。",
        "sources": ["https://kotobank.jp/word/まつさーじ-3171322"],
    },
    (228, "ユニークな(unique)"): {
        "partOfSpeech": "な形容词",
        "note": "原 PDF 标为「名」但词头为ユニークな；规范词头为ユニーク，按原词头实际用法标な形容词。",
    },
    (230, "レンタカー(rent-a-car)"): {
        "gloss": "租赁汽车",
        "note": "原释义「出赁汽车」为中文笔误，结合原英文 rent-a-car 和搭配「レンタカーを借りる」订正为租赁汽车。",
    },
}

# These are inflected adverbial surface forms, not new independent lexemes.
# Fixed adverbs such as 一概に / ろくに / やけに remain unchanged.
ADVERB_STEMS = {
    "げっそりと": ("げっそり", "げっそり"),
    "煌々と": ("煌々", "こうこう"),
    "交互に": ("交互", "こうご"),
    "順繰りに": ("順繰り", "じゅんぐり"),
    "整然と": ("整然", "せいぜん"),
    "即座に": ("即座", "そくざ"),
    "堂々と": ("堂々", "どうどう"),
    "とっさに": ("とっさ", "とっさ"),
    "漠然と": ("漠然", "ばくぜん"),
    "無闇に": ("無闇", "むやみ"),
    "やたらに": ("やたら", "やたら"),
}

VISUALLY_REVIEWED_PAGES = [1, 19, 44, 49, 58, 61, 89, 95, 97, 98, 103, 112,
                         116, 117, 131, 138, 149, 161, 169, 174, 191, 194,
                         201, 208, 210, 211, 214, 217, 222, 223, 224, 227, 228, 230]

POS_NAMES = {
    "名": "名词", "ナ形": "な形容词", "イ形": "い形容词", "副": "副词",
    "他五": "五段他动词", "自五": "五段自动词", "自他五": "五段自他动词",
    "他下一": "一段他动词", "自下一": "一段自动词", "自他下一": "一段自他动词",
    "他上一": "一段他动词", "自上一": "一段自动词", "自他上一": "一段自他动词",
    "他サ": "サ变他动词", "自サ": "サ变自动词", "自他サ": "サ变自他动词",
    "连体": "连体词", "接续": "接续词", "接続": "接续词", "接头": "接头词",
    "接尾": "接尾词", "接续助词": "接续助词", "词组": "惯用表达",
}


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def compact(text: str) -> str:
    return re.sub(r"\s+", "", text)


def nfkc(text: str) -> str:
    return unicodedata.normalize("NFKC", text)


def header_key(header: str) -> str:
    return compact(PITCH.sub("", header))


def normalize_gloss(text: str) -> str:
    # Join Chinese line wrapping; preserve a meaningful space inside Latin text.
    text = re.sub(r"(?<=[\u3000-\u9fff])\s+(?=[\u3000-\u9fff])", "", text)
    return re.sub(r"\s+", " ", text).strip()


def extract(source: Path) -> tuple[list[dict], list[str], list[dict]]:
    rows, pages, checks = [], [], []
    with pdfplumber.open(source) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            page = page.dedupe_chars()
            text = page.extract_text(x_tolerance=2, y_tolerance=3) or ""
            pages.append(text)
            lines = text.splitlines()
            positions = [i for i, line in enumerate(lines) if POS.match(line)]
            # Independent geometric count: printed main headers are 12 pt,
            # examples/body 9.5 pt and section kana titles larger than 12 pt.
            header_chars = [c for c in page.chars if 11.8 <= c["size"] <= 12.2
                            and c["text"].strip() and c["top"] < page.height - 30]
            header_tops = []
            for char in sorted(header_chars, key=lambda c: c["top"]):
                if not header_tops or char["top"] - header_tops[-1] > 2:
                    header_tops.append(char["top"])
            if len(header_tops) != len(positions):
                raise ValueError(f"Page {page_number}: header/POS count mismatch")
            checks.append({"page": page_number, "geometricHeaders": len(header_tops),
                           "parsedRows": len(positions)})
            for j, index in enumerate(positions):
                if index == 0:
                    raise ValueError(f"Page {page_number}: POS line without header")
                header = lines[index - 1]
                if not PITCH.search(header) and header != "やたらに／やたらと":
                    raise ValueError(f"Page {page_number}: unexpected header {header!r}")
                match = POS.match(lines[index])
                end = positions[j + 1] - 1 if j + 1 < len(positions) else len(lines)
                body = lines[index + 1:end]
                gloss_parts = [match[2]]
                continuation = []
                for line in body:
                    if SUPPLEMENT.match(line) or FOOTER.match(line) or len(line) == 1:
                        break
                    continuation.append(line)
                    gloss_parts.append(line)
                gloss = normalize_gloss("".join(gloss_parts))
                if not gloss:
                    raise ValueError(f"Page {page_number}: empty gloss for {header!r}")
                rows.append({"sourceRow": len(rows) + 1, "page": page_number,
                             "sourceLine": index, "header": header,
                             "partOfSpeech": match[1], "gloss": gloss,
                             "glossContinuation": continuation,
                             "bodyLines": [x for x in body if not FOOTER.match(x)]})
    return rows, pages, checks


def normalized_row(row: dict) -> dict:
    key = header_key(row["header"])
    spelling_match = re.match(r"^(.*?)【(.*?)】$", key)
    if spelling_match:
        kana_part, lemma_part = spelling_match.groups()
    else:
        # Parenthesized と is optional adverb syntax; Latin parentheticals
        # are etymologies, not part of the Japanese headword.
        kana_part = re.sub(r"[（(].*$", "", key)
        lemma_part = kana_part
    # 世論 has its reading variants inside parentheses rather than slashes.
    kana_part = kana_part.replace("（", "／").replace("）", "").replace("、", "／")
    readings = [nfkc(x) for x in re.split(r"[／/·・]", kana_part) if x]
    spellings = [nfkc(x) for x in re.split(r"[／/·・]", lemma_part) if x]
    notes = []
    # Adjectival dictionary headwords are the stem; the list prints attributive な.
    # シックな and ユニークな are visibly printed as adjectives but tagged 名.
    adjective = "ナ形" in row["partOfSpeech"] or key.startswith(("シックな(", "ユニークな("))
    if adjective and all(x.endswith("な") for x in spellings):
        spellings = [x[:-1] for x in spellings]
        readings = [x[:-1] if x.endswith("な") else x for x in readings]
        notes.append("原词头的连体词尾「な」已还原为词干。")
    if "（と）" in key:
        notes.append("原词头标有可选的「と」。")
    if "～" in key:
        notes.append("原词头的「～」表示前后接其他成分；词条保留接头/接尾词性。")
        spellings = [x.strip("~〜～") for x in spellings]
        readings = [x.strip("~〜～") for x in readings]
    if spellings[0] in ADVERB_STEMS:
        old_lemma = spellings[0]
        stem, stem_reading = ADVERB_STEMS[old_lemma]
        notes.append("原副词用法「" + "／".join(spellings) + "」按词干「" + stem + "」收录。")
        spellings = [stem]
        readings = [stem_reading]
    pos = "・".join(dict.fromkeys(POS_NAMES[x] for x in row["partOfSpeech"].split("·")))
    entry = {"lemma": spellings[0], "reading": readings[0], "gloss": row["gloss"],
             "partOfSpeech": pos, "sourcePages": [row["page"]],
             "readingVariants": list(dict.fromkeys(readings)),
             "spellingVariants": list(dict.fromkeys(spellings)),
             "notesList": notes, "sourceRows": [row["sourceRow"]],
             "sourceHeader": row["header"], "sourcePartOfSpeech": row["partOfSpeech"]}
    correction = CORRECTIONS.get((row["page"], key))
    if correction:
        entry.update({k: v for k, v in correction.items() if k not in {"note", "sources"}})
        entry["notesList"].append(correction["note"])
    if not KANA.fullmatch(entry["reading"]):
        raise ValueError(f"Non-kana reading at page {row['page']}: {entry['reading']!r}")
    return entry


def merge(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    groups = defaultdict(list)
    for row in rows:
        entry = normalized_row(row)
        groups[nfkc(entry["lemma"])].append(entry)
    result, duplicates = [], []
    for lemma, group in groups.items():
        unique = lambda values: list(dict.fromkeys(values))
        readings = unique(v for e in group for v in e["readingVariants"])
        spellings = unique(v for e in group for v in e["spellingVariants"])
        # Corrections can set the primary reading, while variants retain source readings.
        primary = group[0]["reading"]
        readings = unique([primary, *readings])
        notes = unique(note for e in group for note in e["notesList"])
        if len(readings) > 1:
            notes.append("读音变体：" + "／".join(readings) + "；不同义项见 senses。")
        if len(spellings) > 1:
            notes.append("原资料并列写法：" + "／".join(spellings) + "。")
        senses = []
        for e in group:
            for reading in e["readingVariants"]:
                item = {"reading": reading, "gloss": e["gloss"],
                        "partOfSpeech": e["partOfSpeech"], "sourcePages": e["sourcePages"]}
                same = next((s for s in senses if all(s[k] == item[k] for k in
                                                     ["reading", "gloss", "partOfSpeech"])), None)
                if same:
                    same["sourcePages"] = sorted(set(same["sourcePages"] + item["sourcePages"]))
                else:
                    senses.append(item)
        glosses = unique(e["gloss"] for e in group)
        entry = {"id": "ja-n1-list-" + hashlib.sha1(lemma.encode("utf-8")).hexdigest()[:12],
                 "lemma": lemma, "reading": primary, "gloss": "；".join(glosses),
                 "partOfSpeech": "・".join(unique(e["partOfSpeech"] for e in group)),
                 "context": "", "sourcePages": sorted({p for e in group for p in e["sourcePages"]}),
                 "notes": BASE_NOTE + "".join(notes)}
        if len(readings) > 1 or len(glosses) > 1 or len(group) > 1:
            entry["senses"] = senses
        if len(spellings) > 1:
            entry["spellingVariants"] = spellings
        if len(readings) > 1:
            entry["readingVariants"] = readings
        if any(e.get("needsReview") for e in group):
            entry["needsReview"] = True
        result.append(entry)
        if len(group) > 1:
            duplicates.append({"lemma": lemma, "sourceRows": [n for e in group for n in e["sourceRows"]],
                               "sourcePages": entry["sourcePages"], "senses": senses})
    return result, duplicates


def render(source: Path, folder: Path, pages: list[int]) -> None:
    import pypdfium2 as pdfium
    pdf = pdfium.PdfDocument(str(source))
    for page in pages:
        pdf[page - 1].render(scale=1.8).to_pil().save(folder / f"n1-page-{page:03}.png")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=REPO / "data/n1-2000-vocabulary.json")
    parser.add_argument("--audit-dir", type=Path, default=REPO / ".qa/content-processing/vocab-import")
    parser.add_argument("--render", type=int, nargs="*", default=[])
    args = parser.parse_args()
    sha256 = hashlib.sha256(args.source.read_bytes()).hexdigest()
    if sha256 != SOURCE_SHA256:
        raise ValueError("Source SHA-256 changed; recheck layout and editorial corrections before import")
    rows, pages, checks = extract(args.source)
    assert set(CORRECTIONS).issubset({(r["page"], header_key(r["header"])) for r in rows})
    entries, duplicates = merge(rows)
    assert len(rows) == sum(x["geometricHeaders"] for x in checks) == 2014
    assert len(pages) == 230
    assert len({x["lemma"] for x in entries}) == len(entries)
    assert len({x["id"] for x in entries}) == len(entries)
    assert all(x["lemma"] and x["reading"] and x["gloss"] and x["partOfSpeech"] for x in entries)
    assert all(x["context"] == "" and "level" not in x for x in entries)
    assert set(p for x in entries for p in x["sourcePages"]) == set(range(1, 231))
    write_json(args.output, entries)
    write_json(args.audit_dir / "n1-raw-rows.json", rows)
    write_json(args.audit_dir / "n1-layout-text.json", pages)
    write_json(args.audit_dir / "n1-deduplication.json", duplicates)
    row_mapping = []
    for row in rows:
        lemma = normalized_row(row)["lemma"]
        row_mapping.append({"sourceRow": row["sourceRow"], "page": row["page"],
                            "sourceHeader": row["header"], "lemma": lemma,
                            "id": "ja-n1-list-" + hashlib.sha1(nfkc(lemma).encode("utf-8")).hexdigest()[:12]})
    assert {x["id"] for x in row_mapping} == {x["id"] for x in entries}
    write_json(args.audit_dir / "n1-row-mapping.json", row_mapping)
    report = {"source": str(args.source), "sha256": sha256, "pageCount": len(pages),
              "rawMainEntries": len(rows), "uniqueLemmas": len(entries),
              "mergedExtraRows": len(rows) - len(entries), "duplicateGroups": len(duplicates),
              "skippedRows": [], "levelStatus": "pending-individual-assessment",
              "pagesCovered": list(range(1, 231)), "pageChecks": checks,
              "originalPosCounts": dict(Counter(r["partOfSpeech"] for r in rows)),
              "multilineGlossRows": [r for r in rows if r["glossContinuation"]],
              "editorialCorrections": [{"page": p, "header": h, **v} for (p, h), v in CORRECTIONS.items()],
              "needsReviewLemmas": [e["lemma"] for e in entries if e.get("needsReview")],
              "outputSha256": hashlib.sha256(args.output.read_bytes()).hexdigest(),
              "visualReviewPages": VISUALLY_REVIEWED_PAGES,
              "extractionAmbiguities": [],
              "sourceIntentAmbiguities": [
                  {"page": 58, "printedLemma": "試し", "printedMeaning": "前例",
                   "resolution": "Kept the printed lemma; corrected its gloss to 尝试，试验. Original intended lemma may have been 例."},
                  {"page": 131, "printedLemma": "徹する", "printedMeaning": "撤回，撤销",
                   "resolution": "Kept the printed lemma; corrected gloss and POS. Original intended lemma may have been 撤する."}],
              "dictionaryReviewStatus": "All extracted heads/readings/glosses read; targeted dictionary checks, not a comprehensive dictionary revision.",
              "variantChecks": [
                  {"lemma": "世論", "readings": ["せろん", "せいろん", "よろん"],
                   "source": "https://kotobank.jp/word/世論-87950"},
                  {"lemma": "粒状", "readings": ["つぶじょう", "りゅうじょう"],
                   "source": "https://kotobank.jp/word/粒状-658759"}],
              "notes": ["2014 counts only main headers; related words and examples were not promoted to entries.",
                        "All 230 pages passed independent 12-point header-count versus POS-row count.",
                        "Chinese definitions are source-list scope, not a newly comprehensive dictionary.",
                        "Pronunciation accent numbers and English etymology are excluded from lemma/reading.",
                        "No CFGM grades are inferred from the source title N1."]}
    write_json(args.audit_dir / "n1-import-report.json", report)
    if args.render:
        render(args.source, args.audit_dir, args.render)
    # Read back the persisted output to catch a write/encoding problem.
    assert json.loads(args.output.read_text(encoding="utf-8")) == entries
    print(json.dumps({k: report[k] for k in ["pageCount", "rawMainEntries", "uniqueLemmas", "mergedExtraRows",
                                           "duplicateGroups", "needsReviewLemmas"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
