#!/usr/bin/env python3
"""Generate a Google Sheets-ready workbook of the module checklist.

Outputs:
  docs/module-checklist-by-role.xlsx  — upload to Drive and Open with Google Sheets
  docs/module-checklist-by-role.csv   — File → Import in an existing Sheet

Uses the same task data as docs/_generate_module_checklist_docx.py.
"""

from __future__ import annotations

import csv
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parent
XLSX_OUT = ROOT / "module-checklist-by-role.xlsx"
CSV_OUT = ROOT / "module-checklist-by-role.csv"

HEADERS = [
    "Role",
    "Module",
    "Page",
    "Path",
    "Task title",
    "Subtitle",
    "Status",
]

TAB_NAMES = {
    "Shared shell": "Shared shell",
    "Admin module": "Admin",
    "Sub-Franchisee module": "Sub-Franchisee",
    "Franchisee module": "Franchisee",
    "Retailer module": "Retailer",
}


def load_module(filename: str, name: str):
    path = ROOT / filename
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def flatten_rows(roles) -> list[list[str]]:
    rows = []
    for role in roles:
        for module in role["modules"]:
            for page in module["pages"]:
                for title, subtitle, status in page["tasks"]:
                    rows.append(
                        [
                            role["title"],
                            module["name"],
                            page["name"],
                            page["path"],
                            title,
                            subtitle,
                            status,
                        ]
                    )
    return rows


def write_csv(rows: list[list[str]]) -> None:
    with CSV_OUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(HEADERS)
        writer.writerows(rows)


def fill_sheet(sheet, rows: list[list[str]], *, selected: bool = False) -> None:
    sheet.selected = selected
    widths = [28, 32, 36, 42, 28, 62, 14]
    for col, width in enumerate(widths, 1):
        sheet.width(col, width)
    for col, header in enumerate(HEADERS, 1):
        sheet.text(col, 1, header, "header")
    for r, row in enumerate(rows, 2):
        for c, value in enumerate(row, 1):
            style = "text"
            if c == 7:
                if value == "Completed":
                    style = "section"
                elif value == "In progress":
                    style = "input"
                else:
                    style = "formula"
            sheet.text(c, r, value, style)


def build_xlsx(roles, rows: list[list[str]], counts: dict) -> None:
    xlsx = load_module("_generate_computations_xlsx.py", "computations_xlsx")
    Sheet = xlsx.Sheet
    write_xlsx = xlsx.write_xlsx
    headers = xlsx.headers

    how = Sheet("How to use", freeze=None, selected=True)
    how.width(1, 28)
    how.width(2, 88)
    how.text(1, 1, "Google Sheets version", "title")
    how.text(
        1,
        2,
        "Same checklist as module-checklist-by-role.docx. Status is as of 1 September 2026.",
        "note",
    )
    how.text(1, 4, "Open in Google Sheets", "section")
    how.text(1, 5, "Option A")
    how.text(
        2,
        5,
        "Upload this .xlsx to Google Drive → right-click → Open with → Google Sheets.",
    )
    how.text(1, 6, "Option B")
    how.text(
        2,
        6,
        "In Google Sheets: File → Import → Upload module-checklist-by-role.csv → Replace current sheet.",
    )
    how.text(1, 8, "How to work the sheet", "section")
    how.text(1, 9, "Filter")
    how.text(
        2,
        9,
        "Open the All tasks tab, then Data → Create a filter. Filter Status or Role.",
    )
    how.text(1, 10, "Status values")
    how.text(2, 10, "Completed  ·  In progress  ·  To do")
    how.text(1, 11, "Line format")
    how.text(
        2,
        11,
        "Task title — Subtitle — Status  (columns E, F, G on each tab)",
    )

    summary = Sheet("Summary")
    summary.width(1, 28)
    summary.width(2, 16)
    summary.width(3, 16)
    summary.width(4, 14)
    summary.width(5, 14)
    summary.text(1, 1, "Roll-up", "title")
    headers(summary, 3, ["Role", "Completed", "In progress", "To do", "Total"])
    by_role: dict[str, dict[str, int]] = {}
    for role_name, _module, _page, _path, _title, _sub, status in rows:
        bucket = by_role.setdefault(
            role_name, {"Completed": 0, "In progress": 0, "To do": 0}
        )
        bucket[status] = bucket.get(status, 0) + 1
    r = 4
    for role_name, bucket in by_role.items():
        total = sum(bucket.values())
        summary.text(1, r, role_name)
        summary.put(2, r, bucket["Completed"], "num")
        summary.put(3, r, bucket["In progress"], "num")
        summary.put(4, r, bucket["To do"], "num")
        summary.put(5, r, total, "num")
        r += 1
    summary.text(1, r, "All")
    summary.put(2, r, counts["Completed"], "num")
    summary.put(3, r, counts["In progress"], "num")
    summary.put(4, r, counts["To do"], "num")
    summary.put(5, r, sum(counts.values()), "num")
    summary.text(
        1,
        r + 2,
        "Suggested wiring order: Sub-Franchisee → Franchisee → Retailer → Admin. API-ready client and API wiring are in progress; QA / verification is to do.",
        "note",
    )

    all_tasks = Sheet("All tasks")
    fill_sheet(all_tasks, rows)

    sheets = [how, summary, all_tasks]
    grouped: dict[str, list[list[str]]] = {}
    for row in rows:
        grouped.setdefault(row[0], []).append(row)
    for role in roles:
        tab = TAB_NAMES.get(role["title"], role["title"][:31])
        sheet = Sheet(tab)
        fill_sheet(sheet, grouped.get(role["title"], []))
        sheets.append(sheet)

    write_xlsx(XLSX_OUT, sheets)


def main() -> None:
    checklist = load_module("_generate_module_checklist_docx.py", "module_checklist")
    rows = flatten_rows(checklist.ROLES)
    counts = checklist.count_statuses()
    write_csv(rows)
    build_xlsx(checklist.ROLES, rows, counts)
    print(f"Wrote {XLSX_OUT}")
    print(f"Wrote {CSV_OUT}")
    print(f"Rows: {len(rows)}  ·  {counts}")


if __name__ == "__main__":
    main()
