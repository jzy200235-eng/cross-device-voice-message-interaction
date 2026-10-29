"""Aggregate an authorized local CSV/JSONL. Never emit raw text, IDs or account data.
Added during repository preparation; not an original study analysis script.
Usage: python audit_message_types.py /path/to/authorized.csv
"""
import collections
import csv
import json
import sys
from pathlib import Path


def summarize(path):
    path = Path(path)
    if path.suffix.lower() == '.jsonl':
        rows = [json.loads(line) for line in path.read_text(encoding='utf-8-sig').splitlines() if line.strip()]
    else:
        with path.open(encoding='utf-8-sig', newline='') as source:
            rows = list(csv.DictReader(source))
    labels = collections.Counter(str(row.get('msg_type', '')).strip() for row in rows)
    texts = [str(row.get('transcript_clean', '')) for row in rows]
    ids = [str(row.get('ID', '')) for row in rows]
    return {
        'records': len(rows),
        'category_counts': dict(labels),
        'unique_ids': len(set(ids)),
        'unique_nonempty_clean_texts': len({text for text in texts if text.strip()}),
        'empty_clean_texts': sum(not text.strip() for text in texts),
        'populated_references': sum(
            bool(value.strip()) if isinstance(value := row.get('summary_ref'), str)
            else bool(value.get('bullets')) if isinstance(value, dict) else False
            for row in rows
        ),
    }


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python audit_message_types.py authorized-local-file.csv-or-jsonl')
    print(json.dumps(summarize(sys.argv[1]), ensure_ascii=False, indent=2))
