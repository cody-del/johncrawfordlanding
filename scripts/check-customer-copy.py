#!/usr/bin/env python3
"""Check explicitly supplied public-copy files; standard library only."""
import argparse
import fnmatch
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys

RULES = [
    ("seo-strategy", "block", r"\b(?:this|the)\s+(?:page|article|copy|content)\s+(?:should|must|needs? to)\s+(?:own|target|rank for|avoid cannibali[sz]ing)\b"),
    ("writer-instruction", "block", r"\b(?:this|the)\s+(?:page|article|section|copy|content)\s+(?:should|must|needs? to|is intended to)\b"),
    ("editorial-product-caveat", "block", r"\bshould\s+(?:not\s+)?(?:automatically\s+)?be\s+(?:described|presented|positioned|written)\s+as\b|\brequirements\s+should\s+not\s+be\s+invented\b"),
    ("editorial-note", "block", r"\bnote to (?:writer|editor)\b|\b(?:editorial note|internal note|draft copy|target keyword)\s*:|\b(?:insert|add)\s+(?:copy|keyword|placeholder text)\s+here\b"),
    ("unfinished-placeholder", "block", r"\b(?:lorem ipsum|TODO|TBD)\b|\[(?:insert|replace with)\s+[^\]]+\]"),
    ("contextual-seo-language", "review", r"\b(?:SEO|keywords?|search intent|city intent|keyword cannibalization|link equity|SERPs?|anchor text|content brief|target audience)\b"),
    ("ai-self-reference", "review", r"\bas an AI(?:\s+(?:language model|assistant))?\b"),
]
COMPILED = [(name, level, re.compile(pattern, re.I)) for name, level, pattern in RULES]
RULE_NAMES = {name for name, _, _ in RULES}


def normalize(value):
    return re.sub(r"\s+", " ", html.unescape(str(value)).translate(dict.fromkeys(map(ord, "\u200b\u200c\u200d\ufeff")))).strip()


def strings(value, label="$"):
    if isinstance(value, str):
        yield label, value
    elif isinstance(value, list):
        for i, item in enumerate(value):
            yield from strings(item, f"{label}[{i}]")
    elif isinstance(value, dict):
        for key, item in value.items():
            yield from strings(item, f"{label}.{key}")


class PublicHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hidden = 0
        self.ld = False
        self.ld_buffer = []
        self.text = []
        self.values = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag in ("script", "style"):
            if tag == "script" and attributes.get("type", "").lower() == "application/ld+json":
                self.ld = True
                self.ld_buffer = []
            self.hidden += 1
            return
        if self.hidden:
            return
        for key in ("alt", "title", "aria-label", "aria-description", "placeholder"):
            if attributes.get(key):
                self.values.append((f"{tag}@{key}", attributes[key]))
        if tag == "meta" and attributes.get("content"):
            self.values.append((f"meta:{attributes.get('name') or attributes.get('property') or 'content'}", attributes["content"]))

    def handle_data(self, value):
        if self.ld:
            self.ld_buffer.append(value)
        if not self.hidden:
            self.text.append(value)

    def handle_endtag(self, tag):
        if tag == "script" and self.ld:
            value = "".join(self.ld_buffer)
            try:
                self.values.extend(strings(json.loads(value), "JSON-LD"))
            except json.JSONDecodeError:
                self.values.append(("JSON-LD", value))
            self.ld = False
        if tag in ("script", "style"):
            self.hidden = max(0, self.hidden - 1)

    def values_to_check(self):
        return [("rendered-text", " ".join(self.text)), *self.values]


def file_label(file):
    try:
        return file.resolve().relative_to(Path.cwd()).as_posix()
    except ValueError:
        return file.resolve().as_posix()


def allowed(match, text, file, rule, exceptions):
    for item in exceptions:
        if item["rule"] != rule or not fnmatch.fnmatchcase(file, item["file"]):
            continue
        phrase = normalize(item["text"])
        for occurrence in re.finditer(re.escape(phrase), text):
            if occurrence.start() <= match.start() and match.end() <= occurrence.end():
                return True
    return False


def inspect(value, file, field, exceptions):
    text = normalize(value)
    for rule, level, pattern in COMPILED:
        for match in pattern.finditer(text):
            if not allowed(match, text, file, rule, exceptions):
                yield {"file": file, "field": field, "rule": rule, "level": level,
                       "excerpt": text[max(0, match.start() - 55):match.end() + 100]}


def read_config(filename):
    if not filename:
        return []
    config = json.loads(Path(filename).read_text(encoding="utf-8"))
    if not isinstance(config, dict) or set(config) - {"allow"}:
        raise ValueError("Configuration must be an object containing only an optional 'allow' list.")
    exceptions = config.get("allow", [])
    if not isinstance(exceptions, list):
        raise ValueError("'allow' must be a list.")
    for item in exceptions:
        if not isinstance(item, dict) or set(item) != {"file", "rule", "text", "reason"}:
            raise ValueError("Each exception requires file, rule, text and reason, with no extra fields.")
        if not all(isinstance(v, str) and v.strip() for v in item.values()) or item["rule"] not in RULE_NAMES:
            raise ValueError("Exception fields must be nonempty strings and the rule must exist.")
        if item["file"] in ("*", "**", "**/*"):
            raise ValueError("Exceptions must be scoped more narrowly than every file.")
    return exceptions


def collect(filename, extensions):
    target = Path(filename)
    if not target.exists():
        raise ValueError(f"Missing input: {target}")
    files = [target] if target.is_file() else sorted(p for p in target.rglob("*") if p.is_file() and p.suffix.lower() in extensions)
    if not files or any(p.suffix.lower() not in extensions for p in files):
        raise ValueError(f"Input has no supported files or has an unsupported extension: {target}")
    return files


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ("html", "content-json", "text"):
        parser.add_argument("--" + flag, action="append", default=[], metavar="PATH")
    parser.add_argument("--config")
    parser.add_argument("--report", help="Write a JSON report to this file.")
    parser.add_argument("--strict-review", action="store_true")
    parser.add_argument("--min-html-files", type=int, default=0)
    parser.add_argument("--min-content-files", type=int, default=0)
    args = parser.parse_args(argv)
    try:
        if not (args.html or args.content_json or args.text):
            raise ValueError("Supply at least one --html, --content-json or --text input.")
        if min(args.min_html_files, args.min_content_files) < 0:
            raise ValueError("Inventory minimums cannot be negative.")
        exceptions = read_config(args.config)
        groups = [("html", args.html, {".html", ".htm"}),
                  ("json", args.content_json, {".json"}),
                  ("text", args.text, {".txt", ".md", ".mdx"})]
        seen, findings, counts = set(), [], {"html": 0, "json": 0, "text": 0}
        for kind, inputs, extensions in groups:
            for source in inputs:
                for file in collect(source, extensions):
                    identity = (kind, file.resolve())
                    if identity in seen:
                        continue
                    seen.add(identity)
                    raw = file.read_text(encoding="utf-8")
                    if kind == "html":
                        if not raw.strip():
                            raise ValueError(f"Empty HTML input: {file}")
                        document = PublicHTML()
                        document.feed(raw)
                        values = document.values_to_check()
                    elif kind == "json":
                        values = list(strings(json.loads(raw)))
                    else:
                        values = [("public-text", raw)]
                    if not any(normalize(value) for _, value in values):
                        raise ValueError(f"Input contains no public text: {file}")
                    counts[kind] += 1
                    for field, value in values:
                        findings.extend(inspect(value, file_label(file), field, exceptions))
        if counts["html"] < args.min_html_files or counts["json"] + counts["text"] < args.min_content_files:
            raise ValueError(f"Input inventory below configured minimum: {counts}")
        blockers = [f for f in findings if f["level"] == "block" or args.strict_review]
        report = {"files_checked": counts, "blocked": bool(blockers), "findings": findings}
        if args.report:
            Path(args.report).parent.mkdir(parents=True, exist_ok=True)
            Path(args.report).write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        for issue in findings[:25]:
            level = "BLOCK" if issue in blockers else "REVIEW"
            print(f"{level} {issue['file']} ({issue['field']}): {issue['rule']}\n  {issue['excerpt']}", file=sys.stderr)
        print(f"Customer-copy check: {sum(counts.values())} files; {len(blockers)} blocking findings; {len(findings) - len(blockers)} review warnings.")
        return 1 if blockers else 0
    except (OSError, ValueError, TypeError) as error:
        print(f"Customer-copy check could not complete: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
