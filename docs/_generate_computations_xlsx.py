#!/usr/bin/env python3
"""Write docs/esari-computations.xlsx with the app's live formulas (no extra deps)."""

from __future__ import annotations

import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "esari-computations.xlsx"


def col_letter(index: int) -> str:
    n = index
    letters = ""
    while n > 0:
        n, rem = divmod(n - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def ref(col: int, row: int) -> str:
    return f"{col_letter(col)}{row}"


class Sheet:
    def __init__(self, name: str, freeze: str | None = "A2", selected: bool = False):
        self.name = name
        self.freeze = freeze
        self.selected = selected
        self.cells: dict[tuple[int, int], dict] = {}
        self.col_widths: dict[int, float] = {}
        self.merge: list[tuple[str, str]] = []

    def width(self, col: int, value: float) -> None:
        self.col_widths[col] = value

    def put(self, col: int, row: int, value, style: str = "text", num_fmt: str | None = None):
        cell = {"style": style}
        if isinstance(value, str) and value.startswith("="):
            cell["f"] = value[1:]
            cell["style"] = style if style != "text" else "formula"
            if num_fmt:
                cell["num_fmt"] = num_fmt
        elif isinstance(value, (int, float)):
            cell["v"] = value
            cell["style"] = style
            if num_fmt:
                cell["num_fmt"] = num_fmt
        else:
            cell["t"] = str(value) if value is not None else ""
        self.cells[(col, row)] = cell

    def text(self, col: int, row: int, value: str, style: str = "text") -> None:
        self.put(col, row, value, style)

    def money(self, col: int, row: int, value, style: str = "money") -> None:
        self.put(col, row, value, style, num_fmt="money")

    def pct(self, col: int, row: int, value, style: str = "pct") -> None:
        self.put(col, row, value, style, num_fmt="pct")

    def num(self, col: int, row: int, value, style: str = "num") -> None:
        self.put(col, row, value, style, num_fmt="num")


STYLES = {
    "header": 1,
    "input": 2,
    "formula": 3,
    "section": 4,
    "note": 5,
    "money": 6,
    "money_in": 7,
    "money_f": 8,
    "pct": 9,
    "pct_in": 10,
    "pct_f": 11,
    "num": 12,
    "num_in": 13,
    "num_f": 14,
    "title": 15,
    "text": 0,
    "wrap": 16,
}


def styles_xml() -> str:
    # Fill 0 and 1 are reserved (none, gray125). Fill 3 is input yellow.
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="#,##0.00"/>
    <numFmt numFmtId="165" formatCode="0%"/>
  </numFmts>
  <fonts count="5">
    <font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="14"/><color rgb="FF0F172A"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FF1D4ED8"/><name val="Calibri"/><family val="2"/></font>
    <font><sz val="10"/><color rgb="FF475569"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDEEAF6"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFB4B4B4"/></left>
      <right style="thin"><color rgb="FFB4B4B4"/></right>
      <top style="thin"><color rgb="FFB4B4B4"/></top>
      <bottom style="thin"><color rgb="FFB4B4B4"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="17">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="3" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="165" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="165" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="2" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="2" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="2" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>
"""


def cell_xml(col: int, row: int, cell: dict) -> str:
    r = ref(col, row)
    style_name = cell.get("style", "text")
    s = STYLES.get(style_name, 0)
    fmt = cell.get("num_fmt")
    if fmt == "money" and style_name == "input":
        s = STYLES["money_in"]
    elif fmt == "money" and style_name in ("formula", "money"):
        s = STYLES["money_f"] if style_name == "formula" else STYLES["money"]
    elif fmt == "pct" and style_name == "input":
        s = STYLES["pct_in"]
    elif fmt == "pct" and style_name in ("formula", "pct"):
        s = STYLES["pct_f"] if style_name == "formula" else STYLES["pct"]
    elif fmt == "num" and style_name == "input":
        s = STYLES["num_in"]
    elif fmt == "num" and style_name in ("formula", "num"):
        s = STYLES["num_f"] if style_name == "formula" else STYLES["num"]

    if "f" in cell:
        return f'<c r="{r}" s="{s}"><f>{escape(cell["f"])}</f></c>'
    if "v" in cell:
        return f'<c r="{r}" s="{s}"><v>{cell["v"]}</v></c>'
    text = escape(cell.get("t", ""), {"'": "&apos;", '"': "&quot;"})
    return f'<c r="{r}" s="{s}" t="inlineStr"><is><t xml:space="preserve">{text}</t></is></c>'


def sheet_xml(sheet: Sheet) -> str:
    if not sheet.cells:
        max_row, max_col = 1, 1
    else:
        max_row = max(r for _, r in sheet.cells)
        max_col = max(c for c, _ in sheet.cells)
    dim = f"A1:{ref(max_col, max_row)}"
    cols = []
    for col, width in sorted(sheet.col_widths.items()):
        cols.append(
            f'<col min="{col}" max="{col}" width="{width}" customWidth="1"/>'
        )
    cols_xml = f'<cols>{"".join(cols)}</cols>' if cols else ""
    rows = []
    by_row: dict[int, list[int]] = {}
    for (c, r) in sheet.cells:
        by_row.setdefault(r, []).append(c)
    for r in sorted(by_row):
        cells = "".join(cell_xml(c, r, sheet.cells[(c, r)]) for c in sorted(by_row[r]))
        rows.append(f'<row r="{r}">{cells}</row>')
    tab = "1" if sheet.selected else "0"
    freeze = f"""<sheetViews>
      <sheetView workbookViewId="0" tabSelected="{tab}"/>
    </sheetViews>"""
    if sheet.freeze:
        freeze = f"""<sheetViews>
      <sheetView workbookViewId="0" tabSelected="{tab}">
        <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
      </sheetView>
    </sheetViews>"""
    merge = ""
    if sheet.merge:
        parts = "".join(
            f'<mergeCell ref="{a}:{b}"/>' for a, b in sheet.merge
        )
        merge = f'<mergeCells count="{len(sheet.merge)}">{parts}</mergeCells>'
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="{dim}"/>
  {freeze}
  <sheetFormatPr defaultRowHeight="15"/>
  {cols_xml}
  <sheetData>
    {"".join(rows)}
  </sheetData>
  {merge}
</worksheet>
"""


def workbook_xml(sheets: list[Sheet]) -> str:
    defined = []
    for i, sheet in enumerate(sheets, 1):
        defined.append(
            f'<sheet name="{escape(sheet.name)}" sheetId="{i}" r:id="rId{i}"/>'
        )
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <workbookPr/>
  <calcPr calcId="0" fullCalcOnLoad="1"/>
  <sheets>
    {"".join(defined)}
  </sheets>
</workbook>
"""


def workbook_rels(n: int) -> str:
    rels = []
    for i in range(1, n + 1):
        rels.append(
            f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>'
        )
    rels.append(
        f'<Relationship Id="rId{n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    )
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  {"".join(rels)}
</Relationships>
"""


def content_types(n: int) -> str:
    overrides = [
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    ]
    for i in range(1, n + 1):
        overrides.append(
            f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        )
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  {"".join(overrides)}
</Types>
"""


ROOT_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>
"""


def write_xlsx(path: Path, sheets: list[Sheet]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types(len(sheets)))
        zf.writestr("_rels/.rels", ROOT_RELS)
        zf.writestr("xl/workbook.xml", workbook_xml(sheets))
        zf.writestr("xl/_rels/workbook.xml.rels", workbook_rels(len(sheets)))
        zf.writestr("xl/styles.xml", styles_xml())
        for i, sheet in enumerate(sheets, 1):
            zf.writestr(f"xl/worksheets/sheet{i}.xml", sheet_xml(sheet))


def headers(sheet: Sheet, row: int, values: list[str], start_col: int = 1) -> None:
    for i, value in enumerate(values):
        sheet.text(start_col + i, row, value, "header")


def build_readme() -> Sheet:
    s = Sheet("Read me", freeze=None)
    for col, w in enumerate([42, 72, 36], 1):
        s.width(col, w)
    s.text(1, 1, "eSariSari — detailed computations", "title")
    s.text(1, 2, "Color key", "section")
    s.text(2, 2, "Type here", "input")
    s.text(3, 2, "← Yellow = input. Change this cell; calculators use the same fill.")
    s.text(
        1,
        3,
        "This workbook is the same math the demo app uses (1 September 2026). Grey cells are formulas — do not type over them. Excel recalculates on open. Open the Load calculator or Sale calculator tabs to edit yellow inputs.",
        "note",
    )
    s.text(1, 4, "Two separate earning streams", "section")
    headers(s, 5, ["Stream", "When it happens", "What you earn"])
    s.text(1, 6, "Internet Credits earnings")
    s.text(2, 6, "You release credits after a downline deposit (request or Direct Release)")
    s.text(3, 6, "Admin: cash collected. Sub/Fran: cash in − (credits × your buy rate)")
    s.text(1, 7, "Sales Commission")
    s.text(2, 7, "A retailer records an internet sale")
    s.text(3, 7, "Your % of the customer payment (Sales)")
    s.text(1, 9, "Display rule", "section")
    s.text(1, 10, "1 credit face = ₱1 for display. Available Credits are inventory, not bank cash.")
    s.text(1, 12, "Rounding", "section")
    s.text(
        1,
        13,
        "Every peso amount is ROUND(value, 2), matching the app (two decimal places). Credits suggested from a deposit use the same rounding: ROUND(deposit ÷ rate, 2).",
        "note",
    )
    s.text(1, 15, "Sheets (left to right)", "section")
    headers(s, 16, ["Sheet", "Use it for"])
    s.text(1, 17, "Load calculator")
    s.text(2, 17, "Convert cash ↔ credits, walk 1,000 credits down the chain, compute Sub/Fran spread")
    s.text(1, 18, "Sale calculator")
    s.text(2, 18, "Demo sale: 100% credits consumed (inventory); Commission Settings % of sales")
    s.text(1, 19, "Worked examples")
    s.text(2, 19, "Numbers used in the user guide (₱30,000 load, ₱1,000 sale, 10 / 20 / 30 / 40 of sales)")
    s.text(1, 20, "Demo defaults")
    s.text(2, 20, "Hop rates, commission plans, opening balances, low-balance alert")
    s.text(1, 21, "Read me")
    s.text(2, 21, "This tab — two earning streams, rounding, color key")
    s.text(1, 22, "All formulas")
    s.text(2, 22, "Catalog of every computation and where it appears in the app")
    return s


def build_formulas() -> Sheet:
    s = Sheet("All formulas")
    s.width(1, 34)
    s.width(2, 58)
    s.width(3, 42)
    s.width(4, 42)
    s.text(1, 1, "Formula catalog (matches src/lib)", "title")
    headers(s, 2, ["Name", "App formula", "Excel", "Where you see it"])
    rows = [
        (
            "Suggested credits",
            "credits = deposit ÷ deposit_rate",
            "ROUND(deposit/rate,2)",
            "New Credits Request, Direct Release, Approve & Release",
        ),
        (
            "Cash for N credits",
            "cash = credits × deposit_rate",
            "ROUND(credits*rate,2)",
            "Suggested-credits copy (“1,000 credits = ₱…”) ",
        ),
        (
            "Admin IC earnings",
            "earnings = cash collected on released loads",
            "cash_in",
            "Admin Revenue / Reports — Internet Credits earnings",
        ),
        (
            "Sub/Fran IC earnings (spread)",
            "spread = cash_in − (credits × viewer_buy_rate)",
            "ROUND(cash_in-ROUND(credits*buy_rate,2),2)",
            "Sub/Fran Revenue — Internet Credits earnings",
        ),
        (
            "Credits consumed",
            "credits_consumed = customer_payment",
            "ROUND(payment,2)",
            "Record demo sale, Transactions, Wallet, Revenue (retailer)",
        ),
        (
            "Party commission",
            "share = customer_payment × party_% ÷ 100",
            "ROUND(payment*pct/100,2)",
            "Transaction Details, Revenue Sales Commission, Reports",
        ),
        (
            "Platform remainder",
            "platform = payment − retailer − franchisee − sub-franchisee",
            "ROUND(payment-ret-fran-sub,2)",
            "Transaction Details (absorbs 1-cent rounding)",
        ),
        (
            "Sub-Franchisee remainder % (Admin dialog)",
            "SF% = max(0, 100 − retailer% − franchisee% − platform%)",
            "MAX(0,1-ret-fran-plat)",
            "Admin Commission Settings — Sub share is remainder; platform fee is Admin-editable",
        ),
        (
            "Total earnings (Sub/Fran)",
            "total = IC earnings + Sales Commission (credited)",
            "ic_earnings+sales_commission",
            "Revenue hero cards",
        ),
        (
            "Available Credits",
            "available = opening + received − released − consumed on sales",
            "opening+in-out-consumed",
            "Wallets / Wallet, after-release preview",
        ),
        (
            "Low Balance",
            "0 < available ≤ 5,000",
            "AND(available>0,available<=5000)",
            "Wallet banner, bell, status badge",
        ),
        (
            "Zero Balance",
            "available ≤ 0",
            "available<=0",
            "Wallet banner (red), bell",
        ),
        (
            "Sufficient",
            "available > 5,000",
            "available>5000",
            "Wallet status badge",
        ),
    ]
    for i, (name, formula, excel, where) in enumerate(rows, 3):
        s.text(1, i, name)
        s.text(2, i, formula, "wrap")
        s.text(3, i, excel)
        s.text(4, i, where, "wrap")
    note_row = 3 + len(rows) + 1
    s.text(
        1,
        note_row,
        "Do not use “deposit + %”. Credits are always deposit divided by the rate.",
        "note",
    )
    return s


def build_load() -> Sheet:
    s = Sheet("Load calculator", freeze=None, selected=True)
    for col, w in enumerate([36, 18, 18, 22, 28, 36, 24, 16], 1):
        s.width(col, w)

    s.text(1, 1, "A. Cash → credits (edit yellow cells)", "title")
    s.text(1, 2, "Cash deposited (₱)", "section")
    s.money(2, 2, 7000, "input")
    s.text(3, 2, "Yellow = input")
    s.text(1, 3, "Deposit rate", "section")
    s.pct(2, 3, 0.70, "input")
    s.text(3, 3, "60% = 0.60, 70% = 0.70, 80% = 0.80")
    s.text(1, 4, "Suggested credits")
    s.money(2, 4, "=ROUND(B2/B3,2)", "formula")
    s.text(3, 4, "credits = deposit ÷ rate")
    s.text(1, 5, "Cash for 1,000 credits")
    s.money(2, 5, "=ROUND(1000*B3,2)", "formula")
    s.text(3, 5, "Shown in the suggested-credits explanation")

    s.text(1, 7, "B. Credits moving down the default chain", "title")
    s.text(7, 7, "Credits in this example", "section")
    s.num(8, 7, 1000, "input")
    headers(
        s,
        8,
        [
            "Hop",
            "Deposit rate",
            "Cash paid (₱)",
            "Credits received",
            "Seller cost (₱)",
            "Seller IC earnings (₱)",
        ],
    )
    s.text(1, 9, "Admin → Sub-Franchisee")
    s.pct(2, 9, 0.60, "input")
    s.money(3, 9, "=ROUND($H$7*B9,2)", "formula")
    s.num(4, 9, "=$H$7", "formula")
    s.money(5, 9, 0)
    s.money(6, 9, "=C9", "formula")
    s.text(1, 10, "Sub-Franchisee → Franchisee")
    s.pct(2, 10, 0.70, "input")
    s.money(3, 10, "=ROUND($H$7*B10,2)", "formula")
    s.num(4, 10, "=$H$7", "formula")
    s.money(5, 10, "=ROUND($H$7*B9,2)", "formula")
    s.money(6, 10, "=ROUND(C10-E10,2)", "formula")
    s.text(1, 11, "Franchisee → Retailer")
    s.pct(2, 11, 0.80, "input")
    s.money(3, 11, "=ROUND($H$7*B11,2)", "formula")
    s.num(4, 11, "=$H$7", "formula")
    s.money(5, 11, "=ROUND($H$7*B10,2)", "formula")
    s.money(6, 11, "=ROUND(C11-E11,2)", "formula")
    s.text(
        1,
        13,
        "Admin IC earnings = cash collected (column F = column C). Sub/Fran IC earnings = spread in column F. Retailer does not earn a load spread.",
        "note",
    )

    s.text(1, 15, "C. Sub / Franchisee Internet Credits earnings on one release", "title")
    s.text(1, 16, "Cash in from downline (₱)", "section")
    s.money(2, 16, 14000, "input")
    s.text(1, 17, "Credits released", "section")
    s.money(2, 17, 20000, "input")
    s.text(1, 18, "Your buy rate (what you paid your upline)", "section")
    s.pct(2, 18, 0.60, "input")
    s.text(1, 19, "Sell rate on this release (optional check)")
    s.pct(2, 19, 0.70, "input")
    s.text(1, 20, "Your cost for those credits")
    s.money(2, 20, "=ROUND(B17*B18,2)", "formula")
    s.text(3, 20, "credits × buy rate")
    s.text(1, 21, "Internet Credits earnings (spread)")
    s.money(2, 21, "=ROUND(B16-B20,2)", "formula")
    s.text(3, 21, "cash in − cost")
    s.text(1, 22, "Implied sell rate")
    s.pct(2, 22, "=IF(B17=0,0,B16/B17)", "formula")
    s.text(3, 22, "Should match the downline’s deposit rate if you did not override credits")
    s.text(
        1,
        24,
        "Direct Release uses the same formulas as a released request. It only skips the pending queue.",
        "note",
    )
    return s


def build_sale() -> Sheet:
    s = Sheet("Sale calculator", freeze=None)
    for col, w in enumerate([40, 18, 42, 18], 1):
        s.width(col, w)
    s.text(1, 1, "Demo internet sale (edit yellow cells)", "title")
    s.text(1, 2, "Customer payment (₱)", "section")
    s.money(2, 2, 1000, "input")
    s.text(3, 2, "What Record demo sale asks for")

    s.text(1, 4, "What the app shows", "section")
    headers(s, 5, ["Line", "Amount (₱)", "Formula"])
    s.text(1, 6, "Customer payment")
    s.money(2, 6, "=B2", "formula")
    s.text(3, 6, "Same as the amount you entered")
    s.text(1, 7, "Credits consumed")
    s.money(2, 7, "=B2", "formula")
    s.text(3, 7, "100% of payment — burned from Available Credits")

    s.text(1, 10, "Commission split — % of sales (demo defaults 10 / 20 / 30 / 40)", "title")
    s.text(1, 11, "Retailer %", "section")
    s.pct(2, 11, 0.10, "input")
    s.text(1, 12, "Franchisee %", "section")
    s.pct(2, 12, 0.20, "input")
    s.text(1, 13, "Sub-Franchisee %", "section")
    s.pct(2, 13, 0.30, "input")
    s.text(1, 14, "Platform %", "section")
    s.pct(2, 14, 0.40, "input")
    s.text(1, 15, "Sum of % (must be 100%)")
    s.pct(2, 15, "=B11+B12+B13+B14", "formula")

    headers(s, 17, ["Party", "Share of sales (₱)", "Check"])
    s.text(1, 18, "Retailer")
    s.money(2, 18, "=ROUND($B$2*B11,2)", "formula")
    s.text(1, 19, "Franchisee")
    s.money(2, 19, "=ROUND($B$2*B12,2)", "formula")
    s.text(1, 20, "Sub-Franchisee")
    s.money(2, 20, "=ROUND($B$2*B13,2)", "formula")
    s.text(1, 21, "Platform (remainder after rounding)")
    s.money(2, 21, "=ROUND($B$2-B18-B19-B20,2)", "formula")
    s.text(3, 21, "Not ROUND(sales×40%) — leftover cents go here")
    s.text(1, 22, "Total distributed")
    s.money(2, 22, "=ROUND(B18+B19+B20+B21,2)", "formula")
    s.text(3, 22, "Must equal the customer payment")

    s.text(1, 24, "Sub-Franchisee remainder % (Admin dialog)", "title")
    s.text(1, 25, "Retailer % entered")
    s.pct(2, 25, 0.10, "input")
    s.text(1, 26, "Franchisee % entered")
    s.pct(2, 26, 0.20, "input")
    s.text(1, 27, "Platform share % (Admin-set)")
    s.pct(2, 27, 0.40, "input")
    s.text(1, 28, "Computed Sub-Franchisee %")
    s.pct(2, 28, "=MAX(0,1-B25-B26-B27)", "formula")
    s.text(3, 28, "Admin: SF% = 100% − retailer − franchisee − platform")
    s.text(
        1,
        30,
        "Sub-Franchisee dialog: retailer, franchisee, and Your Share are editable; platform fee is read-only. Four % must equal 100% of sales. Demo seed for every retailer: 10% / 20% / 30% / 40%.",
        "note",
    )
    return s


def build_examples() -> Sheet:
    s = Sheet("Worked examples", freeze=None)
    for col, w in enumerate([44, 18, 18, 48], 1):
        s.width(col, w)
    s.text(1, 1, "Same numbers as the user guide", "title")

    s.text(1, 3, "1. Sub-Franchisee New Credits Request to Admin @ 60%", "section")
    headers(s, 4, ["Step", "Amount (₱)", "", "Formula"])
    s.text(1, 5, "Cash deposited to Admin")
    s.money(2, 5, 30000, "input")
    s.text(1, 6, "Deposit rate")
    s.pct(2, 6, 0.60, "input")
    s.text(1, 7, "Suggested credits")
    s.money(2, 7, "=ROUND(B5/B6,2)", "formula")
    s.text(4, 7, "30,000 ÷ 0.60 = 50,000")

    s.text(1, 9, "2. Sub Direct Release to Franchisee A @ 70%", "section")
    s.text(1, 10, "Cash received from Franchisee A")
    s.money(2, 10, 7000, "input")
    s.text(1, 11, "Sell rate")
    s.pct(2, 11, 0.70, "input")
    s.text(1, 12, "Credits released")
    s.money(2, 12, "=ROUND(B10/B11,2)", "formula")
    s.text(4, 12, "7,000 ÷ 0.70 = 10,000")
    s.text(1, 13, "Sub buy rate (paid Admin)")
    s.pct(2, 13, 0.60, "input")
    s.text(1, 14, "Sub cost")
    s.money(2, 14, "=ROUND(B12*B13,2)", "formula")
    s.text(1, 15, "Sub Internet Credits earnings")
    s.money(2, 15, "=ROUND(B10-B14,2)", "formula")
    s.text(4, 15, "7,000 − 6,000 = 1,000  (same as 10,000 × 10 points)")

    s.text(1, 17, "3. Retailer A New Credits Request @ 80%", "section")
    s.text(1, 18, "Cash deposited to Franchisee A")
    s.money(2, 18, 1600, "input")
    s.text(1, 19, "Deposit rate")
    s.pct(2, 19, 0.80, "input")
    s.text(1, 20, "Suggested credits")
    s.money(2, 20, "=ROUND(B18/B19,2)", "formula")
    s.text(4, 20, "1,600 ÷ 0.80 = 2,000")

    s.text(1, 22, "4. Franchisee earnings on 1,000 credits sold at 80%", "section")
    s.text(1, 23, "Cash in from retailer")
    s.money(2, 23, 800, "input")
    s.text(1, 24, "Credits")
    s.money(2, 24, 1000, "input")
    s.text(1, 25, "Franchisee buy rate")
    s.pct(2, 25, 0.70, "input")
    s.text(1, 26, "Franchisee cost")
    s.money(2, 26, "=ROUND(B24*B25,2)", "formula")
    s.text(1, 27, "Franchisee Internet Credits earnings")
    s.money(2, 27, "=ROUND(B23-B26,2)", "formula")
    s.text(4, 27, "800 − 700 = 100")

    s.text(1, 29, "5. ₱1,000 Retailer A demo sale (10 / 20 / 30 / 40 of sales)", "section")
    s.text(1, 30, "Customer payment")
    s.money(2, 30, 1000, "input")
    s.text(1, 31, "Credits consumed")
    s.money(2, 31, "=B30", "formula")
    s.text(4, 31, "100% of ₱1,000 = ₱1,000 (inventory)")
    s.text(1, 33, "Retailer A 10% of sales")
    s.money(2, 33, "=ROUND(B30*0.10,2)", "formula")
    s.text(4, 33, "100.00")
    s.text(1, 34, "Franchisee A 20% of sales")
    s.money(2, 34, "=ROUND(B30*0.20,2)", "formula")
    s.text(4, 34, "200.00")
    s.text(1, 35, "Sub-Franchisee 30% of sales")
    s.money(2, 35, "=ROUND(B30*0.30,2)", "formula")
    s.text(4, 35, "300.00")
    s.text(1, 36, "Platform 40% (remainder)")
    s.money(2, 36, "=ROUND(B30-B33-B34-B35,2)", "formula")
    s.text(4, 36, "400.00")

    s.text(1, 38, "6. Wallet identity after that sale", "section")
    s.text(1, 39, "Retailer opening / received credits")
    s.money(2, 39, 6250, "input")
    s.text(1, 40, "Credits consumed on the sale")
    s.money(2, 40, "=B31", "formula")
    s.text(1, 41, "Available Credits after the sale")
    s.money(2, 41, "=ROUND(B39-B40,2)", "formula")
    s.text(4, 41, "6,250 − 1,000 = 5,250  (Sufficient, above ₱5,000)")
    s.text(1, 42, "Retailer B sample (low)")
    s.money(2, 42, 2500, "input")
    s.text(1, 43, "Alert?")
    s.text(2, 43, '=IF(B42<=0,"Zero Balance",IF(B42<=5000,"Low Balance","Sufficient"))', "formula")
    s.text(4, 43, "Low Balance banner when ₱5,000 or less, and still above ₱0")
    return s


def build_defaults() -> Sheet:
    s = Sheet("Demo defaults")
    for col, w in enumerate([40, 22, 22, 22, 22, 36], 1):
        s.width(col, w)
    s.text(1, 1, "Locked demo defaults (empty-demo seed)", "title")

    s.text(1, 3, "Deposit rate hops", "section")
    headers(s, 4, ["Hop", "Rate", "Cash for 1,000 credits", "Credits for ₱10,000 cash"])
    s.text(1, 5, "Admin → Sub-Franchisee")
    s.pct(2, 5, 0.60)
    s.money(3, 5, "=ROUND(1000*B5,2)", "formula")
    s.money(4, 5, "=ROUND(10000/B5,2)", "formula")
    s.text(1, 6, "Sub-Franchisee → Franchisee")
    s.pct(2, 6, 0.70)
    s.money(3, 6, "=ROUND(1000*B6,2)", "formula")
    s.money(4, 6, "=ROUND(10000/B6,2)", "formula")
    s.text(1, 7, "Franchisee → Retailer")
    s.pct(2, 7, 0.80)
    s.money(3, 7, "=ROUND(1000*B7,2)", "formula")
    s.money(4, 7, "=ROUND(10000/B7,2)", "formula")

    s.text(1, 9, "Commission Settings (seeded per retailer)", "section")
    headers(
        s,
        10,
        ["Retailer", "Retailer %", "Franchisee %", "Sub-Franchisee %", "Platform %", "Notes"],
    )
    s.text(1, 11, "Retailer A")
    s.pct(2, 11, 0.10)
    s.pct(3, 11, 0.20)
    s.pct(4, 11, 0.30)
    s.pct(5, 11, 0.40)
    s.text(6, 11, "% of sales; demo seed")
    s.text(1, 12, "Retailer B")
    s.pct(2, 12, 0.10)
    s.pct(3, 12, 0.20)
    s.pct(4, 12, 0.30)
    s.pct(5, 12, 0.40)
    s.text(6, 12, "Same default as A")
    s.text(1, 13, "Retailer C")
    s.pct(2, 13, 0.10)
    s.pct(3, 13, 0.20)
    s.pct(4, 13, 0.30)
    s.pct(5, 13, 0.40)
    s.text(6, 13, "Same default as A")
    s.text(1, 14, "New-settings dialog default")
    s.pct(2, 14, 0.10)
    s.pct(3, 14, 0.20)
    s.pct(4, 14, 0.30)
    s.pct(5, 14, 0.40)
    s.text(6, 14, "DEFAULT_SHARE_PERCENTAGES")

    s.text(1, 16, "Opening Available Credits (fresh Reset Demo Data)", "section")
    headers(s, 17, ["Role / org", "Opening credits (₱)"])
    s.text(1, 18, "Admin / platform")
    s.money(2, 18, 500000)
    s.text(1, 19, "Sub-Franchisee")
    s.money(2, 19, 135000)
    s.text(1, 20, "Franchisee A / B")
    s.money(2, 20, 0)
    s.text(1, 21, "Retailer A / B / C")
    s.money(2, 21, 0)

    s.text(1, 23, "Alerts", "section")
    s.text(1, 24, "Low-balance threshold (₱)")
    s.money(2, 24, 5000)
    s.text(3, 24, "LOW_BALANCE_THRESHOLD — alert when available is this amount or less")
    s.text(1, 25, "Zero")
    s.money(2, 25, 0)
    s.text(3, 25, "Red banner; no “or less” copy because the balance is already ₱0")

    s.text(1, 27, "Revenue totals (Sub / Fran)", "section")
    s.text(1, 28, "Internet Credits earnings")
    s.text(2, 28, "Sum of spreads on released downline loads in the selected period")
    s.text(1, 29, "Sales Commission")
    s.text(2, 29, "Sum of your stamped % of sales on completed sales in the period")
    s.text(1, 30, "Total earnings")
    s.text(2, 30, "IC earnings + Sales Commission")
    s.text(1, 31, "Retailer Revenue")
    s.text(2, 31, "No IC spread. Cards: Your commission, sales volume, credits consumed")
    return s


def build() -> Path:
    sheets = [
        build_load(),
        build_sale(),
        build_examples(),
        build_defaults(),
        build_readme(),
        build_formulas(),
    ]
    write_xlsx(OUTPUT, sheets)
    print(f"Wrote {OUTPUT}")
    return OUTPUT


if __name__ == "__main__":
    build()
