"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import FacebookAuthButton from "@/components/FacebookAuthButton";
import DateRangePicker from "@/components/ui/DateRangePicker";
import { fetchAccountData, resetAccountData, fetchAccountPagesOnly } from "@/store/slices/metaSlice";
import { formatNumber, formatCurrency, calculatePercentChange, formatPercent } from "@/lib/metricUtils";

// ── Helpers ────────────────────────────────────────────────────────────────────
const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const getDefault = (days = 30) => {
  const e = new Date(), s = new Date();
  s.setDate(s.getDate() - days);
  return { startDate: s, endDate: e, since: toDateStr(s), until: toDateStr(e) };
};

// ── WoW badge ──────────────────────────────────────────────────────────────────
const TrendUp = () => (
  <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
    <path d="M0.65 5.6L0 4.95L3.45 1.47L5.32 3.34L7.75.93H6.53V0H9.33V2.8H8.4V1.59L5.32 4.67L3.45 2.8L0.65 5.6Z" fill="currentColor" />
  </svg>
);
const TrendDown = () => (
  <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
    <path d="M9.35.4L10 1.05L6.55 4.53L4.68 2.66L2.25 5.07H3.47V6H.67V3.2H1.6V4.41L4.68 1.33L6.55 3.2L9.35.4Z" fill="currentColor" />
  </svg>
);
const TrendLine = ({ color }) => (
  <svg width="28" height="10" viewBox="0 0 28 10" fill="none">
    <path d="M0 8.5L4.09 7.14L8.18 9.32L12.26 4.42L16.35 5.78L20.44.33L27.25 3.06" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function WoWBadge({ pct }) {
  const color = pct === null ? "#9CA3AF" : pct >= 0 ? "#FF6B00" : "#EF4444";
  const bg = pct === null ? "#9CA3AF14" : pct >= 0 ? "#FF6B0019" : "#EF444419";
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-[6px] text-[12px] font-semibold" style={{ color, backgroundColor: bg }}>
      {pct !== null && (pct >= 0 ? <TrendUp /> : <TrendDown />)}
      <span>{formatPercent(pct)}</span>
    </div>
  );
}

export default function AnalyticsOverview() {
  const router = useRouter();
  const dispatch = useDispatch();

  const [dateRange, setDateRange] = useState(() => getDefault(30));
  const [wowEnabled, setWowEnabled] = useState(true);

  const { userAccessToken, isConnected, accountData, loading } = useSelector(s => s.meta);
  const hasLoadedDashboardMetrics = Boolean(
    accountData &&
    (
      Object.keys(accountData.totals || {}).length > 0 ||
      Object.keys(accountData.previousTotals || {}).length > 0 ||
      (accountData.chartData?.length || 0) > 0
    )
  );

  const doFetch = useCallback(() => {
    dispatch(fetchAccountPagesOnly({ accessToken: userAccessToken, limit: 100 }));
    dispatch(fetchAccountData({
      accessToken: userAccessToken,
      since: dateRange.since,
      until: dateRange.until,
      includePrevious: wowEnabled,
    }));
  }, [isConnected, userAccessToken, dateRange.since, dateRange.until, wowEnabled, dispatch]);

  // Initial load
  useEffect(() => {
    if (isConnected && userAccessToken && !loading.account && !hasLoadedDashboardMetrics) {
      doFetch();
    }
  }, [isConnected, userAccessToken, loading.account, hasLoadedDashboardMetrics, doFetch]);

  // Re-fetch when date or WoW changes
  const prevRef = useRef({ since: dateRange.since, until: dateRange.until, wow: wowEnabled });
  useEffect(() => {
    const p = prevRef.current;
    const changed = p.since !== dateRange.since || p.until !== dateRange.until || p.wow !== wowEnabled;
    if (changed && isConnected && userAccessToken) {
      prevRef.current = { since: dateRange.since, until: dateRange.until, wow: wowEnabled };
      dispatch(resetAccountData());
      doFetch();
    }
  }, [dateRange.since, dateRange.until, wowEnabled]); // eslint-disable-line

  // ── Derived ──────────────────────────────────────────────────────────────────
  const totals = accountData?.totals ?? {};
  const prevTotals = accountData?.previousTotals ?? null;
  const pages = accountData?.pages ?? [];
  const prevPages = accountData?.previousPages ?? [];
  
  // Real chart data from store, fallback to empty placeholders if not available
  const chartData = accountData?.chartData?.length > 0 ? accountData.chartData : [
    { name: "Mon", value: 0 }, { name: "Tue", value: 0 }, { name: "Wed", value: 0 },
    { name: "Thu", value: 0 }, { name: "Fri", value: 0 }, { name: "Sat", value: 0 }, { name: "Sun", value: 0 },
  ];

  const cmC = totals.content_monetization_earnings ?? 0;
  const cmP = prevTotals ? (prevTotals.content_monetization_earnings ?? 0) : null;
  const rcC = totals.page_impressions_unique ?? 0;
  const rcP = prevTotals?.page_impressions_unique ?? null;
  const imC = totals.page_media_view ?? 0;
  const imP = prevTotals?.page_media_view ?? null;
  const enC = totals.page_post_engagements ?? 0;
  const enP = prevTotals?.page_post_engagements ?? null;

  const cmPct = wowEnabled ? calculatePercentChange(cmC, cmP) : null;
  const rcPct = wowEnabled ? calculatePercentChange(rcC, rcP) : null;
  const imPct = wowEnabled ? calculatePercentChange(imC, imP) : null;
  const enPct = wowEnabled ? calculatePercentChange(enC, enP) : null;

  // Verification Logs
  if (accountData) {
    console.group('--- Account Dashboard Verification ---');
    console.log('IMPRESSIONS:   ', formatNumber(imC));
    console.log('REACH:         ', formatNumber(rcC));
    console.log('ENGAGEMENT:    ', formatNumber(enC));
    console.groupEnd();
  }

  // ── Not connected ─────────────────────────────────────────────────────────────
  if (!isConnected) return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[70vh]">
      <div className="w-16 h-16 rounded-full bg-[#1A1A1A] border-2 border-[#3A3A3A] flex items-center justify-center mb-6">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="#6B7280">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      </div>
      <h1 className="text-2xl sm:text-3xl font-semibold text-white mb-2 text-center">Network Overview</h1>
      <p className="text-[#9CA3AF] text-[14px] sm:text-[15px] mb-8 text-center max-w-md">Connect your Facebook account to access real-time metrics across all your pages.</p>
      <FacebookAuthButton />
    </div>
  );

  if (loading.accountPages && !accountData?.pages) return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[70vh]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FF6B00]" />
      <p className="mt-4 text-[#9CA3AF]">Initializing network pages…</p>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col gap-5 sm:gap-8 pb-12">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">Network Overview</h1>
          <p className="text-[#9CA3AF] text-[14px] sm:text-[15px]">Real-time performance metrics across all connected Facebook pages.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date picker */}
          <DateRangePicker value={dateRange} onChange={setDateRange} />

          {/* WoW toggle */}
          <div className="flex items-center bg-[#2A2A2A] rounded-lg px-3 sm:px-4 border border-[#3A3A3A] h-[42px] sm:h-[46px] gap-3">
            <span className="text-[13px] sm:text-[14px] text-[#9CA3AF] font-medium select-none">Show WoW%</span>
            <div onClick={() => setWowEnabled(e => !e)}
              className={`w-11 h-5 rounded-full relative cursor-pointer transition-colors ${wowEnabled ? "bg-[#FF6B00]" : "bg-[#131313] border border-[#3A3A3A]"}`}>
              <div className={`absolute top-[2px] w-4 h-4 rounded-full bg-white shadow-sm transition-all ${wowEnabled ? "left-[25px]" : "left-[2px]"}`} />
            </div>
          </div>
        </div>
      </div>

      {/* WoW note */}
      {wowEnabled && (
        <div className="flex items-center gap-2 text-[13px] text-[#9CA3AF] bg-[#FF6B00]/5 border border-[#FF6B00]/10 px-4 py-2 rounded-lg -mt-4">
          <span className="text-[#FF6B00]">◈</span>
          <span>WoW% compares the selected period vs the preceding period of equal length.
            {loading.account && <span className="ml-2 text-[#FF6B00] animate-pulse">Refreshing…</span>}
          </span>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#2A2A2A] p-5 rounded-xl border border-[#3A3A3A] border-t-2 border-t-[#FF6B00]">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[11px] sm:text-[13px] font-medium text-[#9CA3AF] uppercase tracking-wider">Total CM Earnings</span>
            <WoWBadge pct={cmPct} />
          </div>
          <h2 className="text-[28px] sm:text-[32px] font-bold text-[#FF6B00] leading-none tracking-tight mb-4 flex items-center gap-2"
            style={{ textShadow: "0 0 20px rgba(255,107,0,0.2)" }}>
            {loading.account ? <span className="animate-pulse opacity-50">--</span> : formatCurrency(cmC)}
          </h2>
          <div className="flex justify-between items-center">
            <p className="text-[12px] sm:text-[13px] text-[#9CA3AF]">
              {wowEnabled && cmP !== null ? `Prev: ${formatCurrency(cmP)}` : "Aggregated across all pages"}
            </p>
            <div className="text-[#FF6B00] bg-[#FF6B00]/5 p-2 rounded-md"><TrendLine color="#FF6B00" /></div>
          </div>
        </div>

        {[
          { title: "Total Reach", c: rcC, p: rcP, pct: rcPct },
          { title: "Total Impressions", c: imC, p: imP, pct: imPct },
          { title: "Total Engagement", c: enC, p: enP, pct: enPct },
        ].map(card => (
          <div key={card.title} className="bg-[#2A2A2A] p-5 rounded-xl border border-[#3A3A3A]">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[11px] sm:text-[13px] font-medium text-[#9CA3AF] uppercase tracking-wider">{card.title}</span>
              <WoWBadge pct={card.pct} />
            </div>
            <h2 className="text-[28px] sm:text-[32px] font-bold text-white leading-none tracking-tight mb-4">
              {loading.account ? <span className="animate-pulse opacity-50">--</span> : formatNumber(card.c)}
            </h2>
            <div className="flex justify-between items-center">
              <p className="text-[12px] sm:text-[13px] text-[#9CA3AF]">
                {wowEnabled && card.p !== null ? `Prev: ${formatNumber(card.p)}` : "Aggregated total"}
              </p>
              <div className="text-[#FFB693] bg-[#FFB693]/5 p-2 rounded-md"><TrendLine color="#FFB693" /></div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-[#1A1A1A] p-6 rounded-xl border border-[#2A2A2A]">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h3 className="text-[16px] text-[#9CA3AF] font-medium mb-1">Network Earnings Trend</h3>
            <h2 className="text-xl text-white font-semibold">Consolidated Revenue Stream</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#FF6B00] shadow-[0_0_8px_rgba(255,107,0,0.5)]" />
            <span className="text-[#9CA3AF] text-[14px]">Content Monetization</span>
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="99%" height="100%">
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#FF6B00" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2A2A2A" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 13 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9CA3AF", fontSize: 13 }} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={{ backgroundColor: "#131313", borderColor: "#2A2A2A", borderRadius: "8px", color: "#fff" }} itemStyle={{ color: "#FF6B00" }} />
              <Area type="monotone" dataKey="value" stroke="#FF6B00" strokeWidth={3} fillOpacity={1} fill="url(#colorCurrent)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pages Table */}
      <div className="bg-[#2A2A2A] rounded-xl border border-[#3A3A3A] overflow-hidden">
        <div className="p-5 sm:p-8 pb-4">
          <h2 className="text-[18px] sm:text-[22px] font-light text-[#E5E2E1] mb-1">Connected Pages</h2>
          <p className="text-[#6B7280] text-[11px] uppercase tracking-widest font-semibold">FACEBOOK BUSINESS API INTEGRATION</p>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-[#3A3A3A]">
              {["PAGE NAME", "CATEGORY", "FOLLOWERS", "CM EARNINGS ($)", "REACH", "ENGAGEMENT", "WOW%", "STATUS"].map((h, i) => (
                <th key={h} className={`py-5 px-6 font-semibold text-[#6B7280] text-[11px] uppercase tracking-wider${i === 7 ? " text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3A3A3A]">
             {pages.map(page => {
               const prevPage = prevPages.find(p => p.id === page.id);
 
               const curEarnings = page.metrics?.content_monetization_earnings ?? 0;
               const preEarnings = prevPage ? (prevPage.metrics?.content_monetization_earnings ?? 0) : 0;
               const earningsPct = wowEnabled ? calculatePercentChange(curEarnings, preEarnings) : null;
 
               const curReach = page.metrics?.page_impressions_unique ?? 0;
               const preReach = prevPage?.metrics?.page_impressions_unique ?? 0;
               const reachPct = wowEnabled ? calculatePercentChange(curReach, preReach) : null;
 
               const curEng = page.metrics?.page_post_engagements ?? 0;
               const preEng = prevPage?.metrics?.page_post_engagements ?? 0;
               const engPct = wowEnabled ? calculatePercentChange(curEng, preEng) : null;

               // Priority metric for the WOW% column
               const mainPct = [earningsPct, reachPct, engPct].find(v => v !== null) ?? null;
 
               return (
                 <tr key={page.id} className="hover:bg-[#1A1A1A] transition-colors cursor-pointer" onClick={() => router.push(`/analytics/${page.id}`)}>
                   <td className="py-5 px-6">
                     <div className="flex items-center gap-4">
                       <img
                         src={page.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(page.name)}&background=F3E8E0&color=000`}
                         alt={page.name}
                         className="w-10 h-10 rounded-full object-cover border border-[#3A3A3A]"
                       />
                       <span className="text-[#E5E2E1] font-medium text-[13px] max-w-[120px]">{page.name}</span>
                     </div>
                   </td>
                   <td className="py-5 px-6 text-[#9CA3AF] text-[13px]">{page.category}</td>
                   <td className="py-5 px-6 text-[#E5E2E1] text-[13px]">{formatNumber(page.followers)}</td>
                   <td className="py-5 px-6 text-[#FF6B00] text-[14px] font-bold">{formatCurrency(curEarnings)}</td>
                   <td className="py-5 px-6 text-[#E5E2E1] text-[13px]">{formatNumber(curReach)}</td>
                   <td className="py-5 px-6 text-[#E5E2E1] text-[13px]">{formatNumber(curEng)}</td>
                   <td className="py-5 px-6">
                     {wowEnabled && mainPct !== null ? (
                       <div className="flex items-center gap-1.5 font-bold" style={{ color: mainPct >= 0 ? '#10B981' : '#EF4444' }}>
                         {formatPercent(mainPct)}
                       </div>
                     ) : <span className="text-[#6B7280]">--</span>}
                   </td>
                   <td className="py-5 px-6 text-right">
                     <div className="flex items-center justify-end gap-1.5">
                       <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                       <span className="text-[#9CA3AF] text-[11px] font-semibold uppercase">CONNECTED</span>
                     </div>
                   </td>
                 </tr>
               );
             })}
            {pages.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-[#9CA3AF]">No pages found.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>

      {/* Compliance */}
      <div className="bg-[#1C1B1B] rounded-xl border border-[#2A2A2A] p-4 sm:p-6 flex items-start sm:items-center gap-4">
        <svg width="16" height="20" viewBox="0 0 16 20" fill="none" className="shrink-0 mt-0.5 sm:mt-0">
          <path d="M6.95 13.55L12.6 7.9L11.175 6.475L6.95 10.7L4.85 8.6L3.425 10.025L6.95 13.55ZM8 20C5.68 19.42 3.77 18.09 2.26 16.01.75 13.94 0 11.63 0 9.1V3L8 0 16 3V9.1C16 11.63 15.25 13.94 13.74 16.01 12.23 18.09 10.32 19.42 8 20Z" fill="#FF6B00" />
        </svg>
        <div>
          <h3 className="text-white font-bold text-[11px] sm:text-[12px] uppercase tracking-wider mb-1">Meta App Review Compliance</h3>
          <p className="text-[#9CA3AF] text-[12px] sm:text-[13px] leading-relaxed">WoW% compares the selected period vs the immediately preceding period of equal length. Per-page breakdown is available on individual analytics views.</p>
        </div>
      </div>
    </div>
  );
}
