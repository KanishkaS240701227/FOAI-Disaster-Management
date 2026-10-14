"""
PDF dispatch report for a Chennai relief plan.

One page of summary (conditions, headline numbers, depots used) followed by a timed run sheet per truck:
where it leaves from, when it reaches each area, and what it drops there.  All times are Indian Standard Time.
"""

import io
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    HRFlowable, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

IST = timezone(timedelta(hours=5, minutes=30))

INK = colors.HexColor("#15232e")
MUTED = colors.HexColor("#5a6b76")
ACCENT = colors.HexColor("#284a96")
LINE = colors.HexColor("#d5dde1")
PANEL = colors.HexColor("#f1f4f5")
WHITE = colors.white
SEV = {"Low": "#3f9a7b", "Medium": "#b98a14", "High": "#d3611f", "Critical": "#c4303a"}
LEVEL = {"Low": "#3f9a7b", "Elevated": "#b98a14", "High": "#d3611f", "Severe": "#c4303a"}

RES = [("food", "Food packets"), ("water", "Drinking water (cans)"), ("medicine", "Medicine kits"),
       ("blankets", "Blankets"), ("emergency_kits", "Emergency kits")]
RES_SHORT = {"food": "Food", "water": "Water", "medicine": "Medicine", "blankets": "Blankets", "emergency_kits": "Kits"}


def _hm(iso: Any, day0: Any = None) -> str:
    """'2026-10-10T12:16+05:30' -> '12:16' (with the weekday and date when it is not the plan's first day)."""
    try:
        t = datetime.fromisoformat(str(iso))
        if t.tzinfo is None:
            t = t.replace(tzinfo=IST)
        t = t.astimezone(IST)
        if day0 is not None and t.date() != day0:
            return t.strftime("%a %H:%M")
        return t.strftime("%H:%M")
    except Exception:
        return str(iso) if iso else "-"


def _dur(h: float) -> str:
    m = int(round(h * 60))
    return f"{m // 60} h {m % 60:02d} min" if m >= 60 else f"{m} min"


def _num(n: Any) -> str:
    try:
        return f"{int(round(float(n))):,}"
    except Exception:
        return "-"


def _styles() -> Dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()["Normal"]
    mk = lambda name, **kw: ParagraphStyle(name, parent=base, **kw)  # noqa: E731
    return {
        "title": mk("T", fontName="Helvetica-Bold", fontSize=21, leading=25, textColor=INK, spaceAfter=2),
        "sub": mk("S", fontName="Helvetica", fontSize=10, leading=14, textColor=MUTED, spaceAfter=10),
        "h2": mk("H2", fontName="Helvetica-Bold", fontSize=12.5, leading=16, textColor=INK, spaceBefore=14, spaceAfter=6),
        "h3": mk("H3", fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=INK),
        "body": mk("B", fontName="Helvetica", fontSize=9, leading=13, textColor=INK),
        "small": mk("Sm", fontName="Helvetica", fontSize=8, leading=11, textColor=MUTED),
        "cell": mk("C", fontName="Helvetica", fontSize=8, leading=10.5, textColor=INK),
        "cellb": mk("Cb", fontName="Helvetica-Bold", fontSize=8, leading=10.5, textColor=INK),
        "cellr": mk("Cr", fontName="Helvetica", fontSize=8, leading=10.5, textColor=INK, alignment=2),
        "head": mk("Hd", fontName="Helvetica-Bold", fontSize=7.5, leading=10, textColor=MUTED),
        "headr": mk("Hdr", fontName="Helvetica-Bold", fontSize=7.5, leading=10, textColor=MUTED, alignment=2),
        "kpi": mk("K", fontName="Helvetica-Bold", fontSize=15, leading=18, textColor=INK),
        "kpil": mk("Kl", fontName="Helvetica", fontSize=7.5, leading=10, textColor=MUTED),
    }


def _table_style(header: bool = True, zebra: bool = True) -> TableStyle:
    cmds: List[Any] = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
    ]
    if header:
        cmds += [("LINEBELOW", (0, 0), (-1, 0), 0.9, INK)]
    if zebra:
        cmds += [("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PANEL])]
    return TableStyle(cmds)


def _footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(doc.leftMargin, 20, "Chennai Relief Control - dispatch plan. Times are IST. Routes use A* search; assignment uses a genetic algorithm.")
    canvas.drawRightString(doc.pagesize[0] - doc.rightMargin, 20, f"Page {doc.page}")
    canvas.restoreState()


def generate_pdf_report(plan: Dict[str, Any]) -> bytes:
    st = _styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=34, rightMargin=34, topMargin=34, bottomMargin=40,
                            title="Chennai relief dispatch plan", author="Chennai Relief Control")
    width = A4[0] - 68
    story: List[Any] = []

    name = plan.get("scenario_name") or plan.get("name") or "Relief plan"
    start = plan.get("plan_start") or plan.get("generated_at") or datetime.now(IST).isoformat(timespec="minutes")
    day0 = None
    try:
        started = datetime.fromisoformat(start)
        if started.tzinfo is None:
            started = started.replace(tzinfo=IST)
        started = started.astimezone(IST)
        day0 = started.date()
        started_txt = started.strftime("%A %d %B %Y, %H:%M IST")
    except Exception:
        started_txt = str(start)

    story.append(Paragraph("Chennai relief dispatch plan", st["title"]))
    story.append(Paragraph(f"{name}  -  trucks leave at {started_txt}", st["sub"]))
    story.append(HRFlowable(width="100%", thickness=1.4, color=INK, spaceBefore=0, spaceAfter=8))

    # ---------------------------------------------------------------- conditions
    hz = plan.get("hazard") or {}
    if hz:
        lvl = hz.get("level", "")
        lines = [
            f"<b>Conditions:</b> {hz.get('label', '')}. Disaster meter <font color='{LEVEL.get(lvl, '#15232e')}'><b>{hz.get('meter', '-')} / 100 ({lvl})</b></font>; "
            f"most affected zone: {hz.get('peak_zone', '-')}. About {_num(hz.get('pop_at_risk'))} people live in zones scoring High or above.",
            f"Rain {hz.get('rain24', 0)} mm in 24 h and {hz.get('rain72', 0)} mm in 72 h, peak gusts {hz.get('gust_kmh', 0)} km/h"
            + (f", storm surge {hz.get('surge_m')} m" if hz.get("surge_m") else "")
            + (f", {hz.get('quakes')} recent earthquake(s)" if hz.get("quakes") else "") + "."
            + (" Live feeds were out of date when this plan was made." if hz.get("stale") else ""),
        ]
        for ln in lines:
            story.append(Paragraph(ln, st["body"]))
            story.append(Spacer(1, 3))
        story.append(Spacer(1, 4))

    # ---------------------------------------------------------------- headline numbers
    kpis = [
        (f"{plan.get('coverage_pct', 0):g}%", "of requested relief delivered"),
        (_num(plan.get("people_served")), "people fully served"),
        (_dur(plan.get("makespan_hours") or plan.get("total_travel_time_hours") or 0), "until the last delivery"),
        (f"{plan.get('total_distance_km', 0):,.0f} km", f"driven by {len(plan.get('truck_plans') or [])} trucks"),
        (f"{plan.get('total_fuel_liters', 0):,.0f} L", "diesel"),
    ]
    cells = [[Paragraph(v, st["kpi"]) for v, _ in kpis], [Paragraph(l, st["kpil"]) for _, l in kpis]]
    kt = Table(cells, colWidths=[width / len(kpis)] * len(kpis))
    kt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PANEL), ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, 0), 9), ("BOTTOMPADDING", (0, 1), (-1, 1), 9),
        ("TOPPADDING", (0, 1), (-1, 1), 0), ("BOTTOMPADDING", (0, 0), (-1, 0), 1),
        ("LINEAFTER", (0, 0), (-2, -1), 0.5, LINE),
    ]))
    story.append(kt)

    if plan.get("areas_total"):
        story.append(Spacer(1, 6))
        story.append(Paragraph(
            f"{plan.get('areas_planned', 0)} of {plan.get('areas_total')} areas needing relief were planned (the most severe first). "
            f"Road network: {plan.get('network_source', 'approximate')}, with {plan.get('blocked_roads', 0)} roads closed and "
            f"{plan.get('slow_roads', 0)} slowed by flooding.", st["small"]))

    # ---------------------------------------------------------------- depots used
    usage: Dict[str, Dict[str, int]] = plan.get("depot_usage") or {}
    names = {tp.get("warehouse_id"): tp.get("warehouse_name") for tp in plan.get("truck_plans") or []}
    if usage:
        story.append(Paragraph("Depots used", st["h2"]))
        rows = [[Paragraph("Depot", st["head"])] + [Paragraph(RES_SHORT[k], st["headr"]) for k, _ in RES]]
        for wid, u in sorted(usage.items(), key=lambda kv: -sum(kv[1].values())):
            rows.append([Paragraph(names.get(wid) or wid, st["cellb"])] + [Paragraph(_num(u.get(k, 0)), st["cellr"]) for k, _ in RES])
        dt = Table(rows, colWidths=[width - 5 * 62] + [62] * 5, repeatRows=1)
        dt.setStyle(_table_style())
        story.append(dt)

    # ---------------------------------------------------------------- warnings
    warns = plan.get("warnings") or []
    if warns:
        story.append(Paragraph("Things to know", st["h2"]))
        for w in warns[:12]:
            story.append(Paragraph(f"- {w}", st["body"]))

    # ---------------------------------------------------------------- run sheets
    trucks = [t for t in (plan.get("truck_plans") or []) if t.get("stops_detail")]
    if trucks:
        story.append(PageBreak())
        story.append(Paragraph("Run sheets", st["h2"]))
        story.append(Paragraph("Each truck loads at its depot, visits the areas in the order shown and returns. "
                               "Arrival times include road conditions at the time of planning plus 18 minutes unloading at each stop.", st["small"]))
        story.append(Spacer(1, 6))
        for tp in sorted(trucks, key=lambda t: str(t.get("truck_number") or "")):
            head = Table([[
                Paragraph(f"{tp.get('truck_number', tp.get('truck_id', ''))}  -  {tp.get('warehouse_name', '')}", st["h3"]),
                Paragraph(f"leaves {_hm(tp.get('depart_clock'), day0)}   back {_hm(tp.get('return_clock'), day0)}   "
                          f"{tp.get('distance_km', 0):.0f} km   {tp.get('capacity_utilization_pct', 0):.0f}% loaded", st["small"]),
            ]], colWidths=[width * 0.52, width * 0.48])
            head.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, 0), 0.9, INK), ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                                      ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                                      ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
            rows = [[Paragraph("Arrive", st["head"]), Paragraph("Area", st["head"]), Paragraph("People", st["headr"])]
                    + [Paragraph(RES_SHORT[k], st["headr"]) for k, _ in RES]]
            for s in tp.get("stops_detail", []):
                d = s.get("delivered", {})
                sev = s.get("severity", "Medium")
                rows.append([
                    Paragraph(f"<b>{_hm(s.get('eta_clock'), day0)}</b>", st["cell"]),
                    Paragraph(f"{s.get('location_name', '')} <font color='{SEV.get(sev, '#5a6b76')}'>({sev})</font>", st["cell"]),
                    Paragraph(_num(s.get("people_affected")), st["cellr"]),
                ] + [Paragraph(_num(d.get(k, 0)), st["cellr"]) for k, _ in RES])
            tt = Table(rows, colWidths=[58, width - 58 - 46 - 5 * 46, 46] + [46] * 5, repeatRows=1)
            tt.setStyle(_table_style())
            roads = [r for r in (tp.get("road_names") or []) if r and r not in ("Access road", "Approximate link")]
            roads = list(dict.fromkeys(roads))
            via = Paragraph("Main roads: " + ", ".join(roads[:10]) + (" ..." if len(roads) > 10 else ""), st["small"]) if roads else Spacer(1, 0)
            story.append(KeepTogether([head, Spacer(1, 3), tt, Spacer(1, 3), via, Spacer(1, 12)]))

    # ---------------------------------------------------------------- unmet
    unmet = {k: v for k, v in (plan.get("unmet_demands") or {}).items() if v}
    if unmet:
        story.append(Paragraph("Still needed after this plan", st["h2"]))
        story.append(Paragraph(f"{len(unmet)} areas still have part of their request unmet because depot stock or truck capacity ran out. "
                               "Add stock or trucks on the Resources page and plan again.", st["body"]))

    # ---------------------------------------------------------------- method
    ap = plan.get("algorithm_parameters") or {}
    hist = plan.get("generation_history") or []
    gens = hist[-1].get("generation") if hist else ap.get("generations", "-")
    story.append(Paragraph("How this plan was made", st["h2"]))
    story.append(Paragraph(
        f"Travel times come from <b>A* search</b> on the Chennai road network, using the flood-adjusted speed of every road. "
        f"Trucks and visiting order were chosen by a <b>genetic algorithm</b> ({ap.get('population_size', '-')} candidate plans, "
        f"{gens} generations, tournament selection, order crossover, swap mutation) that rewards coverage of the most severe areas first "
        f"and penalises distance, overloaded trucks and fuel overruns. No machine learning is involved, so every number can be traced back to a rule.",
        st["body"]))

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buf.getvalue()
