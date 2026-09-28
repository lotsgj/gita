#!/usr/bin/env python3
"""Validate data/master.csv and its player-relative audio references."""

from collections import Counter, defaultdict
from pathlib import Path
import re
import sys


EXPECTED_HEADER = [
    "cid", "snum", "sid", "shloka_sa", "cname_sa", "meaning_sa",
    "word_by_word_meaning_sa", "shloka_transliteration_en", "cname_en",
    "meaning_en", "word_by_word_meaning_en", "shloka_transliteration_kn",
    "cname_kn", "meaning_kn", "word_by_word_meaning_kn",
    "audio_gita_700", "audio_gita_yoga", "icon_gita_700",
]
SID_PATTERN = re.compile(r"(?:D\.\d+|\d+\.(?:B|E|\d+))\Z")


def main() -> int:
    project_root = Path(__file__).resolve().parent.parent
    master_path = project_root / "data" / "master.csv"
    errors = []
    warnings = []

    try:
        text = master_path.read_text(encoding="utf-8-sig")
    except (OSError, UnicodeError) as exc:
        print(f"ERROR: cannot read {master_path}: {exc}")
        return 1

    physical_lines = text.splitlines()
    if not physical_lines:
        print("ERROR: master.csv is empty")
        return 1

    header = physical_lines[0].split("#")
    if header != EXPECTED_HEADER:
        errors.append(f"header does not exactly match the agreed {len(EXPECTED_HEADER)}-column schema")

    rows = []
    for line_number, line in enumerate(physical_lines[1:], 2):
        if not line:
            errors.append(f"line {line_number}: empty physical record")
            continue
        if line.startswith('"') and line.endswith('"'):
            errors.append(f"line {line_number}: whole-record double-quote wrapper")
        fields = line.split("#")
        if len(fields) != len(EXPECTED_HEADER):
            errors.append(
                f"line {line_number}: {len(fields)} fields; expected {len(EXPECTED_HEADER)}"
            )
            continue
        row = dict(zip(EXPECTED_HEADER, fields))
        row["_line"] = line_number
        rows.append(row)

    sid_counts = Counter(row["sid"] for row in rows)
    for sid, count in sid_counts.items():
        if count > 1:
            errors.append(f"duplicate sid {sid}: {count} records")

    chapters = defaultdict(list)
    for row in rows:
        sid = row["sid"]
        expected_sid = f"{row['cid']}.{row['snum']}"
        if sid != expected_sid:
            errors.append(f"line {row['_line']}: sid {sid!r} should be {expected_sid!r}")
        if not SID_PATTERN.fullmatch(sid):
            errors.append(f"line {row['_line']}: invalid sid format {sid!r}")
        chapters[row["cid"]].append(row)

        for audio_field in ("audio_gita_700", "audio_gita_yoga"):
            audio_path = row[audio_field]
            if not audio_path:
                continue
            if audio_path.startswith("/") or "://" in audio_path:
                errors.append(
                    f"line {row['_line']}: {audio_field} must be player-relative: {audio_path}"
                )
                continue
            if not (project_root / audio_path).is_file():
                errors.append(
                    f"line {row['_line']}: missing {audio_field} file: {audio_path}"
                )

        icon_path = row["icon_gita_700"]
        expected_icon = ""
        if row["sid"] == "D.1":
            expected_icon = "data/gita-700/icons/dhyana.svg"
        elif row["snum"] == "B" and row["cid"].isdigit():
            expected_icon = f"data/gita-700/icons/chapter-{int(row['cid']):02d}.svg"
        if icon_path != expected_icon:
            errors.append(
                f"line {row['_line']}: icon_gita_700 is {icon_path!r}; expected {expected_icon!r}"
            )
        if icon_path and not (project_root / icon_path).is_file():
            errors.append(f"line {row['_line']}: missing icon_gita_700 file: {icon_path}")

    for chapter in range(1, 19):
        cid = str(chapter)
        chapter_rows = chapters.get(cid, [])
        snums = [row["snum"] for row in chapter_rows]
        if snums.count("B") != 1:
            errors.append(f"chapter {cid}: expected one B record; found {snums.count('B')}")
        if snums.count("E") != 1:
            errors.append(f"chapter {cid}: expected one E record; found {snums.count('E')}")
        numeric = sorted(int(value) for value in snums if value.isdigit())
        if numeric:
            expected_numbers = list(range(1, numeric[-1] + 1))
            if numeric != expected_numbers:
                errors.append(f"chapter {cid}: missing or duplicate numbered shlokas")

    populated = {
        field: sum(bool(row[field]) for row in rows)
        for field in ("audio_gita_700", "audio_gita_yoga")
    }
    icon_count = sum(bool(row["icon_gita_700"]) for row in rows)
    if icon_count != 19:
        errors.append(f"icon_gita_700: expected 19 populated values; found {icon_count}")
    if not populated["audio_gita_yoga"]:
        warnings.append("audio_gita_yoga has no populated values")

    print(f"Records: {len(rows)}")
    print(f"audio_gita_700 populated: {populated['audio_gita_700']}")
    print(f"audio_gita_yoga populated: {populated['audio_gita_yoga']}")
    print(f"icon_gita_700 populated: {icon_count}")
    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}")

    if errors:
        print(f"FAILED: {len(errors)} error(s)")
        return 1
    print("PASS: master.csv structure, identifiers, sequencing, and populated audio paths are valid")
    return 0


if __name__ == "__main__":
    sys.exit(main())
