"use client";
import React, { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChevronLeft, ChevronRight, Play, AlertCircle, FileText, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { fetchPageDetails, clearPageCache, fetchPageInsightsOnly, fetchPagePostsOnly, fetchAccountData } from "@/store/slices/metaSlice";
import { getMetricTotal, getMetricTimeSeries, formatNumber, formatCurrency } from "@/lib/metricUtils";
import DateRangePicker from "@/components/ui/DateRangePicker";
import { apiExportPageReport } from "@/lib/api";
const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const getDefault = (days = 30) => {
  const e = new Date(), s = new Date();
  s.setDate(s.getDate() - days);
  return { startDate: s, endDate: e, since: toDateStr(s), until: toDateStr(e) };
};

const nextDay = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return toDateStr(d);
};

const isInRange = (endTime, sinceStr, untilStr) => {
  if (!endTime) return true;
  const dayStr = endTime.substring(0, 10);
  return dayStr > sinceStr && dayStr <= nextDay(untilStr);
};

const toNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const getContentTypeBreakdownTotals = (insightsData, sinceStr, untilStr) => {
  const metric = insightsData?.data?.find((m) => m.name === "content_type_breakdown");
  if (!metric || !Array.isArray(metric.values)) {
    return { videos: 0, reels: 0, photoText: 0 };
  }

  const totals = { videos: 0, reels: 0, photoText: 0 };

  metric.values.forEach((entry) => {
    if (sinceStr && untilStr && !isInRange(entry?.end_time, sinceStr, untilStr)) {
      return;
    }

    const breakdown = entry?.value;
    if (!breakdown || typeof breakdown !== "object") {
      return;
    }

    totals.videos += toNumber(breakdown.video?.earnings_amount) / 1_000_000;
    totals.reels += toNumber(breakdown.reel?.earnings_amount) / 1_000_000;
    totals.photoText += (
      toNumber(breakdown.photo?.earnings_amount) +
      toNumber(breakdown.text?.earnings_amount) +
      toNumber(breakdown.link?.earnings_amount) +
      toNumber(breakdown.other?.earnings_amount)
    ) / 1_000_000;
  });

  return totals;
};

const CustomTooltip = ({ active, payload, label, isEarnings = false }) => {
  if (!active || !payload?.length) return null;
  const val = payload.find(p => p.dataKey === "value")?.value;
  return (
    <div className="bg-[#131313] border border-[#2A2A2A] rounded-lg p-3 text-white">
      <p className="text-[#9CA3AF] mb-1 text-[12px]">{label}</p>
      {val !== undefined && <p className="text-[#FF6B00] text-[13px] font-semibold">{isEarnings ? formatCurrency(val) : formatNumber(val)}</p>}
    </div>
  );
};

export default function PageAnalyticsDetail() {
  const [activeTab, setActiveTab] = useState("ALL POSTS");
  const [isExporting, setIsExporting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [dateRange, setDateRange] = useState(() => getDefault(30));
  const { id } = useParams();
  const router = useRouter();
  const dispatch = useDispatch();

  const { userAccessToken, isConnected, pagesCache, accountData, loading } = useSelector(s => s.meta);
  const pageData = pagesCache[id];
  const pageMetadata = accountData?.pages?.find(p => p.id === id);

  useEffect(() => {
    setMounted(true);
    setIsHydrated(true);
  }, []);

  // Restore account/page metadata on refresh (Name, Category, Followers, etc.)
  useEffect(() => {
    if (isConnected && userAccessToken && (!accountData || !accountData.pages)) {
      console.log("[frontend] Restoring missing account metadata on refresh...");
      dispatch(fetchAccountData({ accessToken: userAccessToken }));
    }
  }, [isConnected, userAccessToken, accountData, dispatch]);

  useEffect(() => {
    if (isConnected && userAccessToken && !pageData && !loading.page) {
      dispatch(fetchPageInsightsOnly({ pageId: id, since: dateRange.since, until: dateRange.until }));
      dispatch(fetchPagePostsOnly({ pageId: id, since: dateRange.since, until: dateRange.until }));
    }
  }, [isConnected, userAccessToken, id]); // eslint-disable-line

  const handleDateChange = (newRange) => {
    setDateRange(newRange);
    dispatch(fetchPageInsightsOnly({ pageId: id, since: newRange.since, until: newRange.until }));
    dispatch(fetchPagePostsOnly({ pageId: id, since: newRange.since, until: newRange.until }));
  };

  const handleExportReport = async () => {
    try {
      setIsExporting(true);
      const res = await apiExportPageReport({ pageId: id, since: dateRange.since, until: dateRange.until });
      if (res?.url) {
        window.open(res.url, "_blank");
      } else {
        alert("Failed to generate report.");
      }
    } catch (error) {
      console.error("Export error:", error);
      alert("An error occurred while generating the report.");
    } finally {
      setIsExporting(false);
    }
  };

  if (!isHydrated) return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FF6B00]" />
      <p className="mt-4 text-[#9CA3AF]">Loading page analytics...</p>
    </div>
  );

  if (!isConnected) return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <AlertCircle size={48} className="text-[#9CA3AF] mb-4" />
      <h2 className="text-xl text-white font-medium mb-2">Authentication Required</h2>
      <p className="text-[#9CA3AF] mb-6">Connect your Facebook account to view page analytics.</p>
      <Link href="/connected-pages" className="bg-[#FF6B00] text-white px-6 py-2.5 rounded-lg font-medium">Connect Facebook</Link>
    </div>
  );

  if (loading.page && !pageData?.insights && !pageData?.posts) return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FF6B00]" />
      <p className="mt-4 text-[#9CA3AF]">Initializing Page Analytics…</p>
    </div>
  );

  const insights = pageData?.insights || { data: [] };
  const posts = pageData?.posts?.data || [];

  const daysCount = Math.round((dateRange.endDate - dateRange.startDate) / (1000 * 60 * 60 * 24));
  const prevStart = new Date(dateRange.startDate);
  prevStart.setDate(prevStart.getDate() - daysCount - 1);
  const prevEnd = new Date(dateRange.startDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevSince = toDateStr(prevStart);
  const prevUntil = toDateStr(prevEnd);

  const cmEarnings = getMetricTotal(insights, "content_monetization_earnings", dateRange.since, dateRange.until);
  const reach = getMetricTotal(insights, "page_impressions_unique", dateRange.since, dateRange.until);
  const impressions = getMetricTotal(insights, "page_media_view", dateRange.since, dateRange.until);
  const engagements = getMetricTotal(insights, "page_post_engagements", dateRange.since, dateRange.until);
  const videoViews = getMetricTotal(insights, "page_video_views", dateRange.since, dateRange.until);
  const followers = pageMetadata?.followers || getMetricTotal(insights, "page_follows", dateRange.since, dateRange.until);

  // Chart Data: Dual period earnings comparison
  const currentEarningsSeries = getMetricTimeSeries(insights, "content_monetization_earnings", dateRange.since, dateRange.until);
  const prevEarningsSeries = getMetricTimeSeries(insights, "content_monetization_earnings", prevSince, prevUntil);

  const dualChartData = currentEarningsSeries.map((d, i) => {
    const curVal = d.value || 0;
    const prevVal = prevEarningsSeries[i]?.value || 0;
    return {
      name: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "2-digit" }).toUpperCase(),
      value: curVal,
      prevValue: prevVal
    };
  });

  const breakdownTotals = getContentTypeBreakdownTotals(insights, dateRange.since, dateRange.until);

  if (pageData && mounted) {
    const _debugMetric = insights?.data?.find(m => m.name === 'page_media_view');
    if (_debugMetric) {
      console.log('ALL database end_times:', _debugMetric.values.map(v => v.end_time?.slice(0, 10)).sort());
    }
  }

  const timeseries = getMetricTimeSeries(insights, "page_impressions_unique", dateRange.since, dateRange.until);
  const chartData = timeseries.map(item => ({
    name: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "2-digit" }).toUpperCase(),
    value: item.value,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col gap-5 sm:gap-6 pb-12">

      <div className="flex items-center gap-3 -mb-2">
        <Link href="/" className="text-[#9CA3AF] text-[13px] font-bold tracking-widest uppercase hover:text-white transition-colors">
          &larr; BACK TO DASHBOARD
        </Link>
      </div>

      {/* Profile row + date picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-[56px] h-[56px] lg:w-[64px] lg:h-[64px] rounded-lg overflow-hidden shrink-0 border border-white/5 shadow-2xl">
            {(pageData?.insights?.picture?.data?.url || pageMetadata?.picture) ? (
              <img src={pageData?.insights?.picture?.data?.url || pageMetadata?.picture} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="animate-pulse w-full h-full bg-[#1A1A1A] flex items-center justify-center text-white/10 font-bold text-xl">{(id || "").slice(0, 1)}</div>
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[20px] sm:text-[26px] font-bold text-white tracking-tight leading-tight">
                {pageData?.insights?.name || pageMetadata?.name || (loading.page ? "Loading..." : "Page Details")}
              </h1>
              <span className="bg-[#1E1E1E] text-[#9CA3AF] text-[9px] font-black px-2 py-1 rounded-[4px] tracking-widest uppercase border border-white/5">
                {pageData?.insights?.category || pageMetadata?.category || "MEDIA/NEWS"}
              </span>
              {loading.page && <span className="text-[#00FF94]/30 animate-pulse text-[10px] font-black uppercase tracking-[0.2em] ml-2">SYNCING...</span>}
            </div>

            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-[#6B7280] text-[13px] sm:text-[15px] font-medium tracking-tight">
                {loading.page && !pageData?.insights ? "--" : formatNumber(followers)} followers
              </span>

              <div className="flex items-center gap-2">
                {isConnected ? (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[10px] font-bold text-[#059669] bg-[#065F46]/20 border border-[#059669]/20 uppercase">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-[#10B981]"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    CONNECTED
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[10px] font-bold text-[#9CA3AF] bg-[#3A3A3A]/40 border border-[#9CA3AF]/20 uppercase">
                    DISCONNECTED
                  </span>
                )}
                
                {cmEarnings > 0 ? (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[10px] font-bold text-[#059669] bg-[#065F46]/20 border border-[#059669]/20 uppercase">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#10B981]"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                    MONETIZED
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[10px] font-bold text-[#9CA3AF] bg-[#3A3A3A]/40 border border-[#9CA3AF]/20 uppercase">
                    NON MONETIZED
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 scale-95 origin-right self-start sm:self-center">
          <DateRangePicker value={dateRange} onChange={handleDateChange} />
          <button 
            onClick={handleExportReport}
            disabled={isExporting || loading.page}
            className={`bg-[#FF6B00] hover:bg-[#E66000] text-[#572000] font-bold uppercase text-[12px] tracking-widest px-5 py-[11px] rounded-[4px] transition-colors flex items-center justify-center min-w-[140px] ${isExporting || loading.page ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isExporting ? "GENERATING..." : "EXPORT REPORT"}
          </button>
        </div>
      </div>

      {/* Monetization Breakdown cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total CM Earnings card */}
        <div className="bg-[#1C1B1B] p-6 rounded-xl border border-white/5 shadow-2xl relative overflow-hidden group min-h-[160px]">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#FF6B00]/20" />
          <span className="text-[11px] font-black text-[#6B7280] uppercase tracking-[0.2em] block mb-6">TOTAL CM EARNINGS</span>
          <div className="w-10 h-[2px] bg-[#FF6A00]/40 mb-6" />
          <h2 className="text-[34px] font-bold text-[#FF6B00] leading-none mb-4" style={{ textShadow: "0 0 20px rgba(255,107,0,0.15)" }}>
            {loading.page && !pageData?.insights ? <span className="animate-pulse opacity-50">--</span> : formatCurrency(cmEarnings)}
          </h2>
          <p className="text-[10px] text-[#6B7280] font-bold uppercase tracking-widest mt-auto">Calculated from all formats</p>
        </div>

        {[
          {
            title: "VIDEOS",
            value: breakdownTotals.videos
          },
          {
            title: "REELS",
            value: breakdownTotals.reels
          },
          {
            title: "PHOTOS/TEXT",
            value: breakdownTotals.photoText
          }
        ].map(card => {
          const totalBreakdown = 1; // Logic for progress bar if needed
          return (
            <div key={card.title} className="bg-[#1C1B1B] p-6 rounded-xl border border-white/5 flex flex-col justify-between shadow-lg hover:border-white/10 transition-all min-h-[160px]">
              <div>
                <span className="text-[11px] font-black text-[#6B7280] uppercase tracking-[0.2em] block mb-6">{card.title}</span>
                <h2 className="text-[28px] font-bold text-white leading-none mb-6">
                  {loading.page && !pageData?.insights ? <span className="animate-pulse opacity-50">--</span> : formatCurrency(card.value)}
                </h2>
              </div>
              <div className="w-full h-[3px] bg-[#2A2A2A] rounded-full overflow-hidden">
                <div className="h-full bg-[#FFB693]/40 rounded-full w-1/3" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart container */}
      <div className="flex flex-col gap-4">
        <div className="bg-[#1C1B1B] p-8 rounded-2xl border border-white/5 h-[360px] shadow-2xl">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-[16px] text-white font-bold tracking-tight mb-1">Daily Earnings Overview</h3>
              <p className="text-[#6B7280] text-[11px] font-black uppercase tracking-[0.2em]">Live Revenue Analytics</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#FF6B00]" />
                <span className="text-[#9CA3AF] text-[10px] font-bold tracking-[0.2em] uppercase">CURRENT PERIOD</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#5A4136]" />
                <span className="text-[#9CA3AF] text-[10px] font-bold tracking-[0.2em] uppercase">PREVIOUS PERIOD</span>
              </div>
            </div>
          </div>
          <div className="h-[210px] w-full">
            {mounted && dualChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dualChartData} margin={{ top: 0, right: 0, left: -40, bottom: 0 }} barCategoryGap={10}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#4B5563", fontSize: 9, fontWeight: 800 }} dy={15} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip isEarnings={true} />} cursor={{ fill: "rgba(255,107,0,0.03)", radius: 4 }} />
                  <Bar dataKey="prevValue" fill="#573D30" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="value" fill="#FF6B00" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[#4B5563] text-[12px] font-bold uppercase tracking-widest">
                {loading.page ? "Synchronizing Data..." : "No revenue available for this period"}
              </div>
            )}
          </div>
        </div>

        {/* Overview Metrics row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 bg-[#131110] p-4 sm:p-6 lg:p-8 rounded-2xl border border-white/5 shadow-inner">
          {[
            { label: "IMPRESSIONS", value: impressions, trend: "+12.4%", accent: "#FF6B00" },
            { label: "REACH", value: reach, trend: "+8.1%", accent: "#FFB693" },
            { label: "ENGAGEMENT", value: engagements, trend: "+15.2%", accent: "#00D1FF" },
            { label: "VIDEO VIEWS", value: videoViews, trend: "+22.8%", accent: "#A78BFA" },
            { label: "FAN GROWTH", value: followers, trend: "+4.5%", accent: "#00FF94" }
          ].map((m) => (
            <div key={m.label} className="bg-[#1C1B1B] lg:bg-transparent rounded-xl lg:rounded-none p-4 lg:p-0 flex flex-col gap-2 lg:border-l lg:border-white/5 lg:pl-6 first:lg:border-l-0 first:lg:pl-0">
              <div className="w-6 h-[2px] rounded-full lg:hidden" style={{ backgroundColor: m.accent }} />
              <span className="text-[10px] font-black text-[#6B7280] uppercase tracking-[0.15em]">{m.label}</span>
              <div className="flex items-end gap-2">
                <span className="text-white text-[22px] sm:text-[24px] font-bold tracking-tighter leading-none">
                  {loading.page && !pageData?.insights ? <span className="animate-pulse opacity-50">--</span> : formatNumber(m.value)}
                </span>
                <span className="text-[#00FF94] text-[11px] font-black tracking-tight pb-0.5">{m.trend}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Posts section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {["ALL POSTS", "VIDEOS", "REELS", "PHOTOS", "LINKS"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-3 sm:px-5 py-2 rounded-lg font-semibold text-[12px] sm:text-[13px] transition-colors ${activeTab === tab ? "bg-[#FF6B00] text-[#572000]" : "bg-[#2A2A2A] text-[#E5E2E1] hover:bg-[#3A3A3A]"}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* ── Desktop table (md+) ── */}
        <div className="hidden md:block bg-transparent overflow-hidden border border-[#2A2A2A] rounded-xl text-[14px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#2A2A2A] bg-[#131313]">
                <th className="py-4 px-6 font-medium text-[#9CA3AF] w-2/5">Content</th>
                <th className="py-4 px-6 font-medium text-[#9CA3AF]">Published</th>
                <th className="py-4 px-6 font-medium text-[#9CA3AF]">Reach</th>
                <th className="py-4 px-6 font-medium text-[#9CA3AF] text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {posts.filter(post => {
                if (activeTab === "ALL POSTS") return true;
                const type = post.status_type || "";
                const attType = post.attachments?.data?.[0]?.type || "";
                if (activeTab === "VIDEOS") return type === "added_video" || attType.includes("video");
                if (activeTab === "REELS") return type === "shared_story" || attType.includes("reel");
                if (activeTab === "PHOTOS") return type === "added_photos" || attType.includes("photo");
                if (activeTab === "LINKS") return type === "link" || attType === "share";
                return true;
              }).map((post, i) => {
                const reach = post.insights?.data?.find(x => x.name === "post_impressions_unique")?.values?.[0]?.value || 0;
                const thumb = post.attachments?.data?.[0]?.media?.image?.src;
                const attType = post.attachments?.data?.[0]?.type || "";
                
                const isVideo = attType.includes("video");
                const isReel = attType.includes("reel");
                const isPhoto = attType.includes("photo") || attType.includes("image");

                const typeBadge = isVideo
                  ? <span className="bg-[#FF6B00]/10 text-[#FF6B00] text-[8px] font-black px-1.5 py-0.5 rounded-[2px] tracking-widest uppercase">VIDEO</span>
                  : isReel
                    ? <span className="bg-[#00D1FF]/10 text-[#00D1FF] text-[8px] font-black px-1.5 py-0.5 rounded-[2px] tracking-widest uppercase">REEL</span>
                    : <span className="bg-[#9CA3AF]/10 text-[#9CA3AF] text-[8px] font-black px-1.5 py-0.5 rounded-[2px] tracking-widest uppercase">{isPhoto ? "PHOTO" : "TEXT ONLY"}</span>;
                return (
                  <tr key={post.id || i} className="border-b border-[#2A2A2A] last:border-0 hover:bg-[#131313]/50 transition-colors cursor-pointer" onClick={() => router.push(`/analytics/${id}/post/${post.id}`)}>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[2px] bg-[#1A1A1A] border border-[#2A2A2A] shrink-0 overflow-hidden flex items-center justify-center relative shadow-inner">
                          {thumb ? (
                            <>
                              <img src={thumb} alt="" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                              {(isVideo || isReel) && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                  <div className="w-4 h-4 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                                    <Play size={8} className="fill-white text-white ml-0.5" />
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            isVideo || isReel 
                              ? <Play size={14} className="text-[#9CA3AF] opacity-60" /> 
                              : isPhoto 
                                ? <ImageIcon size={14} className="text-[#9CA3AF] opacity-60" /> 
                                : <FileText size={14} className="text-[#9CA3AF] opacity-60" />
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">{typeBadge}</div>
                          <span className="text-white font-medium line-clamp-1">{post.message || "No caption"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-[#9CA3AF]">{post.created_time ? new Date(post.created_time).toLocaleDateString() : "--"}</td>
                    <td className="py-4 px-6 text-white font-medium">{formatNumber(reach)}</td>
                    <td className="py-4 px-6 text-right">
                      <Link href={`/analytics/${id}/post/${post.id}`}
                        className="inline-flex items-center justify-center bg-[#FF6B00]/10 hover:bg-[#FF6B00] text-[#FF6B00] hover:text-black py-2.5 px-6 rounded-lg text-[11px] font-black tracking-[0.05em] border border-[#FF6B00]/20 transition-all uppercase min-w-[120px] whitespace-nowrap">
                        VIEW POST
                      </Link>
                    </td>
                  </tr>
                );
              }).slice(0, 10)}
              {posts.length === 0 && !loading.page && (
                <tr><td colSpan={4} className="py-12 text-center text-[#9CA3AF]">No published posts found for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Mobile post cards (< md) ── */}
        <div className="md:hidden flex flex-col gap-3">
          {posts.filter(post => {
            if (activeTab === "ALL POSTS") return true;
            const type = post.status_type || "";
            const attType = post.attachments?.data?.[0]?.type || "";
            if (activeTab === "VIDEOS") return type === "added_video" || attType.includes("video");
            if (activeTab === "REELS") return type === "shared_story" || attType.includes("reel");
            if (activeTab === "PHOTOS") return type === "added_photos" || attType.includes("photo");
            if (activeTab === "LINKS") return type === "link" || attType === "share";
            return true;
          }).map((post, i) => {
            const reach = post.insights?.data?.find(x => x.name === "post_impressions_unique")?.values?.[0]?.value || 0;
            const thumb = post.attachments?.data?.[0]?.media?.image?.src;
            const type = post.status_type || "";
            const attType = post.attachments?.data?.[0]?.type || "";
            const isVideo = attType.includes("video");
            const isReel = attType.includes("reel");
            const isPhoto = attType.includes("photo") || attType.includes("image");
            
            const badgeColor = isVideo ? "#FF6B00" : isReel ? "#00D1FF" : isPhoto ? "#A78BFA" : "#9CA3AF";
            const badgeLabel = isVideo ? "VIDEO" : isReel ? "REEL" : isPhoto ? "PHOTO" : "TEXT ONLY";
            return (
              <div
                key={post.id || i}
                onClick={() => router.push(`/analytics/${id}/post/${post.id}`)}
                className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl overflow-hidden active:scale-[0.99] transition-all cursor-pointer"
              >
                {/* Thumb strip */}
                {thumb && (
                  <div className="w-full h-40 overflow-hidden relative">
                    <img src={thumb} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <span
                      className="absolute bottom-2 left-3 text-[9px] font-black px-2 py-0.5 rounded-[3px] tracking-widest uppercase"
                      style={{ color: badgeColor, backgroundColor: `${badgeColor}18`, border: `1px solid ${badgeColor}30` }}
                    >{badgeLabel}</span>
                  </div>
                )}
                <div className="p-4">
                  {!thumb && (
                    <span
                      className="inline-block mb-2 text-[9px] font-black px-2 py-0.5 rounded-[3px] tracking-widest uppercase"
                      style={{ color: badgeColor, backgroundColor: `${badgeColor}18`, border: `1px solid ${badgeColor}30` }}
                    >{badgeLabel}</span>
                  )}
                  <p className="text-white font-medium text-[14px] line-clamp-2 mb-3">{post.message || "No caption"}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Published</span>
                        <span className="text-[#9CA3AF] text-[12px]">{post.created_time ? new Date(post.created_time).toLocaleDateString() : "--"}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Reach</span>
                        <span className="text-white font-bold text-[13px]">{formatNumber(reach)}</span>
                      </div>
                    </div>
                    <Link
                      href={`/analytics/${id}/post/${post.id}`}
                      onClick={e => e.stopPropagation()}
                      className="bg-[#FF6B00]/10 hover:bg-[#FF6B00] text-[#FF6B00] hover:text-black text-[10px] font-black tracking-widest uppercase px-4 py-2 rounded-lg border border-[#FF6B00]/20 transition-all whitespace-nowrap"
                    >
                      VIEW POST
                    </Link>
                  </div>
                </div>
              </div>
            );
          }).slice(0, 10)}
          {posts.length === 0 && !loading.page && (
            <div className="py-12 text-center text-[#9CA3AF]">No published posts found for this period.</div>
          )}
        </div>

        <div className="flex items-center justify-between mt-1 px-1">
          <span className="text-[#9CA3AF] text-[13px] sm:text-[14px]">Displaying {posts.length} posts</span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 bg-[#2A2A2A] hover:bg-[#3A3A3A] rounded-md text-[#9CA3AF] hover:text-white transition-colors"><ChevronLeft size={16} /></button>
            <button className="px-3.5 py-1.5 bg-[#FF6B00] text-[#572000] font-semibold text-[14px] rounded-md">1</button>
            <button className="px-3 py-1.5 bg-[#2A2A2A] hover:bg-[#3A3A3A] rounded-md text-[#9CA3AF] hover:text-white transition-colors"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
