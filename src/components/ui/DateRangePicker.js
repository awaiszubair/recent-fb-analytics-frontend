"use client";
import React, { useState, useEffect, useRef } from "react";
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// ── Date helpers (timezone-safe) ──────────────────────────────────────────────
const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmt = (d) => d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
const norm = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const sameDay = (a, b) => a && b && norm(a) === norm(b);
const before = (a, b) => a && b && norm(a) < norm(b);

const grid = (year, month) => {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0).getDate();
  let dow = (first.getDay() + 6) % 7; // Mon=0
  const cells = [];
  for (let i = dow; i > 0; i--) cells.push({ d: new Date(year, month, 1 - i), cur: false });
  for (let d = 1; d <= last; d++) cells.push({ d: new Date(year, month, d), cur: true });
  while (cells.length < 42) cells.push({ d: new Date(year, month + 1, cells.length - dow - last + 1), cur: false });
  return cells;
};

const SHORTCUTS = [
  { label: "Today", fn: () => { const d = new Date(); return [d, d]; } },
  { label: "Last 7 Days", fn: () => { const e = new Date(), s = new Date(); s.setDate(s.getDate() - 6); return [s, e]; } },
  { label: "Last 14 Days", fn: () => { const e = new Date(), s = new Date(); s.setDate(s.getDate() - 13); return [s, e]; } },
  { label: "Last 30 Days", fn: () => { const e = new Date(), s = new Date(); s.setDate(s.getDate() - 29); return [s, e]; } },
  { label: "This Month", fn: () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth(), 1), n]; } },
  { label: "Last Month", fn: () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth() - 1, 1), new Date(n.getFullYear(), n.getMonth(), 0)]; } },
];

export default function DateRangePicker({ value, onChange }) {
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(value?.startDate || null);
  const [end, setEnd] = useState(value?.endDate || null);
  const [hover, setHover] = useState(null);
  const [phase, setPhase] = useState("start");
  const initM = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const initY = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const [lY, setLY] = useState(initY);
  const [lM, setLM] = useState(initM);
  const rY = lM === 11 ? lY + 1 : lY, rM = lM === 11 ? 0 : lM + 1;
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const openPicker = () => { setStart(value?.startDate || null); setEnd(value?.endDate || null); setPhase("start"); setOpen(true); };

  const clickDay = (d) => {
    if (phase === "start") { setStart(d); setEnd(null); setPhase("end"); }
    else if (before(d, start)) { setStart(d); setEnd(null); }
    else { setEnd(d); setPhase("start"); }
  };

  const applyShortcut = (fn) => { const [s, e] = fn(); setStart(s); setEnd(e); setPhase("start"); };

  const apply = () => { if (start && end) onChange({ startDate: start, endDate: end, since: toDateStr(start), until: toDateStr(end) }); setOpen(false); };
  const cancel = () => { setStart(value?.startDate || null); setEnd(value?.endDate || null); setOpen(false); };
  const prevM = () => { if (lM === 0) { setLY(y => y - 1); setLM(11); } else setLM(m => m - 1); };
  const nextM = () => { if (lM === 11) { setLY(y => y + 1); setLM(0); } else setLM(m => m + 1); };

  const activeEnd = end || (phase === "end" ? hover : null);
  const rS = start && activeEnd ? (before(start, activeEnd) ? start : activeEnd) : start;
  const rE = start && activeEnd ? (before(start, activeEnd) ? activeEnd : start) : null;
  const inRange = (d) => rS && rE && norm(d) > norm(rS) && norm(d) < norm(rE);

  const label = value?.startDate && value?.endDate
    ? `${fmt(value.startDate)} – ${fmt(value.endDate)}`
    : "Select date range";

  const renderMonth = (year, month) => (
    <div style={{ width: 224 }}>
      <div className="text-[15px] font-semibold text-white text-center mb-3">{MONTHS[month]} {year}</div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => <div key={d} className="text-[11px] font-bold text-[#6B7280] text-center py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {grid(year, month).map(({ d, cur }, i) => {
          const sel = sameDay(d, start) || sameDay(d, end);
          const isS = sameDay(d, rS), isE = sameDay(d, rE), inR = inRange(d);
          const isToday = sameDay(d, now);
          return (
            <div key={i}
              className={["relative h-9 flex items-center justify-center",
                inR ? "bg-[#FF6B0015]" : "",
                isS && rE ? "bg-gradient-to-r from-transparent to-[#FF6B0015]" : "",
                isE && rS ? "bg-gradient-to-l from-transparent to-[#FF6B0015]" : "",
              ].join(" ")}
              onMouseEnter={() => phase === "end" && cur && setHover(d)}
              onMouseLeave={() => setHover(null)}
              onClick={() => cur && clickDay(d)}
            >
              <button className={["w-8 h-8 rounded-full text-[13px] font-medium transition-all duration-150",
                !cur ? "opacity-25 cursor-default pointer-events-none" : "cursor-pointer",
                sel ? "bg-[#FF6B00] text-white shadow-[0_0_12px_rgba(255,107,0,0.35)]" : "",
                !sel && isToday ? "border border-[#FF6B00] text-[#FF6B00]" : "",
                !sel && !isToday && inR ? "text-white" : "",
                !sel && !isToday && !inR && cur ? "text-[#E5E2E1] hover:bg-[#2A2A2A]" : "",
              ].join(" ")}>
                {d.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="relative" ref={ref}>
      <button onClick={openPicker} className="flex items-center gap-2 bg-[#1A1A1A] px-4 py-2.5 rounded-lg border border-[#2A2A2A] hover:bg-[#202020] transition-colors h-[46px]">
        <Calendar size={16} className="text-[#9CA3AF]" />
        <span className="text-[14px] text-white font-medium whitespace-nowrap">{label}</span>
        <ChevronDown size={14} className="text-[#9CA3AF] ml-1" />
      </button>

      {open && (
        <>
          {/* Mobile Backdrop */}
          <div className="fixed inset-0 z-[90] bg-black/60 md:hidden" onClick={() => setOpen(false)} />

          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:absolute md:top-full md:left-auto md:right-0 md:translate-x-0 md:translate-y-0 w-max min-w-[310px] md:min-w-fit md:w-auto max-w-[95vw] md:max-w-none mt-0 md:mt-2 z-[100] bg-[#141414] border border-[#2A2A2A] rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.8)] md:shadow-2xl flex flex-col md:flex-row overflow-hidden origin-center md:origin-top-right">
            {/* Shortcuts */}
            <div className="w-full md:w-[152px] border-b md:border-b-0 md:border-r border-[#2A2A2A] p-2 md:p-4 flex flex-row md:flex-col overflow-x-auto gap-1 md:gap-0.5 scrollbar-hide">
              <p className="hidden md:block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider mb-3 px-2">Quick Select</p>
              {SHORTCUTS.map(s => (
                <button key={s.label} onClick={() => applyShortcut(s.fn)}
                  className="whitespace-nowrap text-center md:text-left text-[12px] md:text-[13px] text-[#9CA3AF] hover:text-white hover:bg-[#2A2A2A] px-3 py-1.5 md:py-2 rounded-lg transition-colors md:w-full shrink-0">
                  {s.label}
                </button>
              ))}
            </div>

            {/* Calendar */}
            <div className="p-3 md:p-5 flex flex-col gap-0 w-full overflow-hidden">
              <div className="flex items-start justify-between md:justify-start md:gap-2">
                <button onClick={prevM} className="mt-1 p-1.5 rounded-lg hover:bg-[#2A2A2A] text-[#9CA3AF] hover:text-white transition-colors shrink-0">
                  <ChevronLeft size={16} />
                </button>
                <div className="flex md:gap-5 justify-center flex-1">
                  {renderMonth(lY, lM)}
                  <div className="hidden md:block w-px bg-[#2A2A2A] self-stretch" />
                  <div className="hidden md:block">
                    {renderMonth(rY, rM)}
                  </div>
                </div>
                <button onClick={nextM} className="mt-1 p-1.5 rounded-lg hover:bg-[#2A2A2A] text-[#9CA3AF] hover:text-white transition-colors shrink-0">
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Footer */}
              <div className="border-t border-[#2A2A2A] mt-3 md:mt-4 pt-3 md:pt-4 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-8">
                <div className="text-[12px] md:text-[13px] text-[#9CA3AF] text-center md:text-left">
                  {start && end
                    ? <><span className="text-white">{fmt(start)}</span><span className="mx-1">→</span><span className="text-white">{fmt(end)}</span></>
                    : start
                      ? <><span className="text-white">{fmt(start)}</span><span className="text-[#FF6B00] md:ml-2 mx-1 md:mx-0">→</span><span className="text-white">pick end</span></>
                      : <span>Pick a start date</span>}
                </div>
                <div className="flex gap-2 shrink-0 w-full md:w-auto">
                  <button onClick={cancel} className="flex-1 md:flex-none px-4 py-2 rounded-lg text-[13px] text-[#9CA3AF] hover:text-white hover:bg-[#2A2A2A] transition-colors bg-[#202020] md:bg-transparent">Cancel</button>
                  <button onClick={apply} disabled={!start || !end}
                    className="flex-1 md:flex-none px-5 py-2 rounded-lg text-[13px] font-semibold bg-[#FF6B00] text-white hover:bg-[#FF8533] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    Apply Range
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
