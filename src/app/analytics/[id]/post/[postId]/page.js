"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Play } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchPostMetadataOnly, fetchPostInsightsOnly, fetchAccountData } from '@/store/slices/metaSlice';
import { getMetricTotal, formatNumber, formatCurrency } from '@/lib/metricUtils';

// Extract reaction totals from post_reactions_by_type_total metric
const getReactionTotals = (insightsData) => {
  const metric = insightsData?.data?.find(m => m.name === "post_reactions_by_type_total");
  if (!metric?.values?.length) return {};
  const totals = {};
  const mapping = { 'SORRY': 'SAD', 'ANGER': 'ANGRY' };
  metric.values.forEach(v => {
    if (typeof v.value === "object" && v.value !== null) {
      Object.entries(v.value).forEach(([type, count]) => {
        let key = type.toUpperCase();
        if (mapping[key]) key = mapping[key];
        totals[key] = (totals[key] || 0) + (typeof count === "number" ? count : 0);
      });
    }
  });
  return totals;
};

// Compute nested objects like `post_clicks_by_type`
const computeNestedObjectValue = (insightsData, metricName, keyMatch) => {
  const metric = insightsData?.data?.find(m => m.name === metricName);
  if (!metric?.values?.length) return 0;
  let total = 0;
  metric.values.forEach(v => {
    if (typeof v.value === "object" && v.value !== null) {
      Object.entries(v.value).forEach(([k, val]) => {
        if (typeof val === 'number' && (!keyMatch || k.toLowerCase().includes(keyMatch.toLowerCase()))) {
          total += val;
        }
      });
    }
  });
  return total;
};

// Avg watch time helper
const fmtWatchTime = (ms) => {
  if (!ms || ms === 0) return "--";
  const s = Math.round(ms / 1000);
  if (s < 60) return `0:${String(s).padStart(2, "0")}`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function PostDetailPage() {
  const [mounted, setMounted] = useState(false);
  const { id: pageId, postId } = useParams();
  const dispatch = useDispatch();

  const { userAccessToken, isConnected, postsCache, pagesCache, accountData, loading } = useSelector(s => s.meta);
  const postData = postsCache[postId];
  const pageCache = pagesCache[pageId];
  const pagePosts = Array.isArray(pageCache?.posts) ? pageCache.posts : (pageCache?.posts?.data || []);
  const postContent = pagePosts.find(p => p.id === postId);

  // Author info
  const selectedPage = accountData?.pages?.find(p => p.id === pageId);
  const authorName = selectedPage?.name || "Connected Page";

  useEffect(() => { setMounted(true); }, []);

  // Restore account/page metadata on refresh (Author Name, etc.)
  useEffect(() => {
    if (isConnected && userAccessToken && (!accountData || !accountData.pages)) {
      console.log("[frontend] Restoring missing account metadata on post refresh...");
      dispatch(fetchAccountData({ accessToken: userAccessToken }));
    }
  }, [isConnected, userAccessToken, accountData, dispatch]);

  useEffect(() => {
    if (isConnected && userAccessToken && !loading.post) {
      dispatch(fetchPostMetadataOnly({ postId, pageId }));
      dispatch(fetchPostInsightsOnly({ postId, pageId }));
    }
  }, [isConnected, userAccessToken, postId, pageId]); // eslint-disable-line

  if (!isConnected) return (
    <div className="p-8 max-w-[1200px] mx-auto flex flex-col items-center justify-center min-h-screen text-white bg-[#15130f]">
      <h2 className="text-xl font-medium mb-4">Authentication Required</h2>
      <Link href="/connected-pages" className="bg-[#FFB693] text-black px-6 py-2.5 rounded-lg font-bold tracking-widest uppercase">Connect Facebook</Link>
    </div>
  );

  if (loading.post && !postData && !postData?.metadata) return (
    <div className="p-8 max-w-[1200px] mx-auto flex flex-col items-center justify-center min-h-screen text-[#FFB693] bg-[#15130f]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-current" />
      <p className="mt-4 font-bold tracking-widest uppercase">Loading Post Insights...</p>
    </div>
  );

  // ── Derived metrics ──────────────────────────────────────────────────────────
  const insights = postData?.insights || { data: [] };
  const cmEarnings = getMetricTotal(insights, "content_monetization_earnings")
    + getMetricTotal(insights, "monetization_approximate_earnings");

  const reach = getMetricTotal(insights, "post_impressions_unique");
  const impressions = getMetricTotal(insights, "post_media_view");
  const organicReach = getMetricTotal(insights, "post_impressions_organic_unique");
  const paidReach = getMetricTotal(insights, "post_impressions_paid_unique");
  const totalOrganicPaid = organicReach + paidReach || 1;
  const organicPct = ((organicReach / totalOrganicPaid) * 100).toFixed(0);
  const paidPct = ((paidReach / totalOrganicPaid) * 100).toFixed(0);

  const reactionTotals = getReactionTotals(insights);
  const totalReactions = Object.values(reactionTotals).reduce((a, b) => a + b, 0);
  const likesCount = reactionTotals['LIKE'] || 0;
  const sharesCount = postData?.shares?.shares_count ?? 0;
  const commentsCount = postData?.comments?.comments_count ?? 0;

  const engagedUsers = totalReactions + sharesCount + commentsCount;
  const linkClicks = computeNestedObjectValue(insights, "post_clicks_by_type", "link");
  const photoViews = computeNestedObjectValue(insights, "post_clicks_by_type", "photo");
  const otherClicks = computeNestedObjectValue(insights, "post_clicks_by_type", "other");
  const postClicks = linkClicks + photoViews + otherClicks; // Added postClicks to replace the deleted metric
  const totalClicksByType = postClicks || 1;
  const linkPct = ((linkClicks / totalClicksByType) * 100).toFixed(0);
  const photoPct = ((photoViews / totalClicksByType) * 100).toFixed(0);
  const otherPct = ((otherClicks / totalClicksByType) * 100).toFixed(0);

  const videoViews3s = getMetricTotal(insights, "post_video_views");
  const videoViews1m = getMetricTotal(insights, "post_video_views_10s");
  const avgWatch = getMetricTotal(insights, "post_video_avg_time_watched");

  const retentionMetric = insights?.data?.find(m => m.name === "post_video_retention_graph");
  const rawRetention = retentionMetric?.values?.[0]?.value;
  // If it's an object of percentages, convert to sorted array of values
  const retentionData = rawRetention ? Object.keys(rawRetention).sort((a, b) => Number(a) - Number(b)).map(k => rawRetention[k]) : [];

  const retentionRateValue = retentionData.length > 0 ? retentionData[retentionData.length - 1] : 0;
  const retentionRate = retentionData.length > 0 ? `${Math.round(retentionRateValue)}%` : "--";

  // Reaction totals already computed above for Engaged Users.

  // ── Post content from metadata (fetched) or cache ───────────────────────────
  const finalContent = postData?.metadata || postContent;
  const message = finalContent?.message || (loading.post ? "Loading content..." : "View details natively on Facebook.");
  const createdAt = finalContent?.created_time
    ? new Date(finalContent.created_time).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : loading.post ? "Fetching publish date..." : "Data not found in cache";
  const permalink = finalContent?.permalink_url || `https://facebook.com/${postId}`;
  const thumb = finalContent?.attachments?.data?.[0]?.media?.image?.src || null;
  const isVideo = finalContent?.attachments?.data?.[0]?.type?.includes("video") || finalContent?.attachments?.data?.[0]?.type?.includes("reel") || finalContent?.status_type === "added_video";

  // Layout container

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto flex flex-col gap-5 sm:gap-6 pb-12 font-sans bg-[#15130f] min-h-screen text-white">

      <div className="flex items-center gap-3">
        <Link href={`/analytics/${pageId}`} className="text-[#9CA3AF] text-[13px] font-bold tracking-widest uppercase hover:text-white transition-colors">
          &larr; BACK TO PAGE
        </Link>
        {loading.post && <span className="text-[#FFB693] animate-pulse text-[11px] font-black tracking-widest bg-white/5 px-2 py-1 rounded">● REFRESHING DATA...</span>}
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Post Preview */}
        <div className="bg-[#2A2A2A] border border-[#2A2A2A] rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=FFB693&color=fff&size=80`}
                alt="Avatar"
                className="w-10 h-10 rounded-[2px]"
              />
              <div>
                <h3 className="text-white font-medium text-[15px] leading-tight">{authorName}</h3>
                <p className="text-[#9CA3AF] text-[12px]">
                  {loading.post && !finalContent ? <span className="animate-pulse">Fetching details...</span> : `Published ${createdAt}`}
                </p>
              </div>
            </div>
            <p className="text-white mb-4 text-[14px] line-clamp-3">
              {message}
            </p>
            {thumb || isVideo ? (
              <div 
                onClick={() => isVideo && window.open(permalink, '_blank')}
                className={`bg-[#131313] w-full aspect-video rounded-lg mb-4 flex items-center justify-center border border-[#2A2A2A] overflow-hidden relative group ${isVideo ? 'cursor-pointer' : ''}`}
              >
                {thumb ? (
                  <>
                    <img src={thumb} alt="Post Thumbnail" className="w-full h-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-110" />
                    {isVideo && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-80 group-hover:opacity-100 transition-opacity">
                        <div className="w-16 h-16 rounded-full bg-[#FFB693]/30 backdrop-blur-md flex items-center justify-center border border-[#FFB693]/50">
                          <Play className="fill-white text-white ml-1" size={32} />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-b from-[#11313A] to-[#0A1B20] flex flex-col justify-center items-center">
                    <h1 className="text-white font-black text-4xl tracking-[0.2em] mb-4 opacity-40">VIDEO</h1>
                    <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                      <Play className="fill-white text-white ml-1" size={24} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#131313]/40 w-full aspect-video rounded-lg mb-4 flex flex-col items-center justify-center border border-dashed border-[#2A2A2A]">
                <span className="text-[#9CA3AF] text-[11px] font-bold tracking-[0.2em] uppercase opacity-40">NO MEDIA CONTENT</span>
                <span className="text-[#9CA3AF]/40 text-[9px] mt-1 font-bold tracking-widest uppercase">TEXT ONLY POST</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between mt-auto">
            <button onClick={() => navigator.clipboard.writeText(permalink)} className="flex items-center gap-2 text-[#FFB693] text-[12px] font-bold tracking-widest uppercase hover:opacity-80 transition-opacity">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              Copy Link
            </button>
            <a href={permalink} target="_blank" rel="noopener noreferrer" className="text-[#9CA3AF] text-[12px] font-bold tracking-widest uppercase hover:text-white transition-colors">
              View Live Post
            </a>
          </div>
        </div>

        {/* Right Column - 5 Cards */}
        <div className="flex flex-col gap-4">
          <div className="bg-[#FF6B00] rounded-xl py-8 px-6 relative overflow-hidden h-[auto] min-h-[140px] flex flex-col justify-center">
            <div className="absolute -right-8 -bottom-8 opacity-20 transform rotate-12">
              <svg width="160" height="160" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM11 19.93C7.05 19.43 4 16.05 4 12C4 7.95 7.05 4.57 11 4.07V19.93ZM13 4.07C16.95 4.57 20 7.95 20 12C20 16.05 16.95 19.43 13 19.93V4.07Z" /></svg>
            </div>
            <span className="text-[11px] font-bold tracking-widest text-[#572000] uppercase mb-2 relative z-10">Estimated Earnings</span>
            <div className="flex items-center gap-2 relative z-10">
              <h2 className="text-[36px] font-bold text-[#572000] leading-none">
                {loading.post && !postData?.insights ? <span className="animate-pulse opacity-50">--</span> : formatCurrency(cmEarnings)}
              </h2>
            </div>
            <div className="flex gap-4 mt-3 relative z-10">
              <div className="bg-black/10 rounded px-2 py-1">
                <span className="text-[10px] text-white/70 block">ENGAGEMENT RATE</span>
                <span className="text-white font-medium text-[12px]">
                  {loading.post && !postData?.insights ? "-- " : (reach > 0 ? ((engagedUsers / reach) * 100).toFixed(2) : 0)}%
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 flex-1">
            {/* Impressions */}
            <div className="bg-[#2A2A2A] border border-[#2A2A2A] rounded-xl p-5 flex flex-col justify-center gap-3">
              <svg width="22" height="15" viewBox="0 0 22 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 12C12.25 12 13.3125 11.5625 14.1875 10.6875C15.0625 9.8125 15.5 8.75 15.5 7.5C15.5 6.25 15.0625 5.1875 14.1875 4.3125C13.3125 3.4375 12.25 3 11 3C9.75 3 8.6875 3.4375 7.8125 4.3125C6.9375 5.1875 6.5 6.25 6.5 7.5C6.5 8.75 6.9375 9.8125 7.8125 10.6875C8.6875 11.5625 9.75 12 11 12ZM11 10.2C10.25 10.2 9.6125 9.9375 9.0875 9.4125C8.5625 8.8875 8.3 8.25 8.3 7.5C8.3 6.75 8.5625 6.1125 9.0875 5.5875C9.6125 5.0625 10.25 4.8 11 4.8C11.75 4.8 12.3875 5.0625 12.9125 5.5875C13.4375 6.1125 13.7 6.75 13.7 7.5C13.7 8.25 13.4375 8.8875 12.9125 9.4125C12.3875 9.9375 11.75 10.2 11 10.2ZM11 15C8.56667 15 6.35 14.3208 4.35 12.9625C2.35 11.6042 0.9 9.78333 0 7.5C0.9 5.21667 2.35 3.39583 4.35 2.0375C6.35 0.679167 8.56667 0 11 0C13.4333 0 15.65 0.679167 17.65 2.0375C19.65 3.39583 21.1 5.21667 22 7.5C21.1 9.78333 19.65 11.6042 17.65 12.9625C15.65 14.3208 13.4333 15 11 15ZM11 13C12.8833 13 14.6125 12.5042 16.1875 11.5125C17.7625 10.5208 18.9667 9.18333 19.8 7.5C18.9667 5.81667 17.7625 4.47917 16.1875 3.4875C14.6125 2.49583 12.8833 2 11 2C9.11667 2 7.3875 2.49583 5.8125 3.4875C4.2375 4.47917 3.03333 5.81667 2.2 7.5C3.03333 9.18333 4.2375 10.5208 5.8125 11.5125C7.3875 12.5042 9.11667 13 11 13Z" fill="#FFB693" />
              </svg>
              <div>
                <h3 className="text-[20px] font-bold text-white leading-none mb-1">
                  {loading.post && !postData?.insights ? <span className="animate-pulse">--</span> : formatNumber(impressions)}
                  {console.log("The POST Impression are: ", impressions)}
                </h3>
                <span className="text-[10px] font-bold tracking-widest text-[#9CA3AF] uppercase">Impressions</span>
              </div>
            </div>

            {/* Likes */}
            <div className="bg-[#2A2A2A] border border-[#2A2A2A] rounded-xl p-5 flex flex-col justify-center gap-3">
              <svg width="20" height="19" viewBox="0 0 20 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 18.35L8.55 17.05C6.86667 15.5333 5.475 14.225 4.375 13.125C3.275 12.025 2.4 11.0375 1.75 10.1625C1.1 9.2875 0.645833 8.48333 0.3875 7.75C0.129167 7.01667 0 6.26667 0 5.5C0 3.93333 0.525 2.625 1.575 1.575C2.625 0.525 3.93333 0 5.5 0C6.36667 0 7.19167 0.183333 7.975 0.55C8.75833 0.916667 9.43333 1.43333 10 2.1C10.5667 1.43333 11.2417 0.916667 12.025 0.55C12.8083 0.183333 13.6333 0 14.5 0C16.0667 0 17.375 0.525 18.425 1.575C19.475 2.625 20 3.93333 20 5.5C20 6.26667 19.8708 7.01667 19.6125 7.75C19.3542 8.48333 18.9 9.2875 18.25 10.1625C17.6 11.0375 16.725 12.025 15.625 13.125C14.525 14.225 13.1333 15.5333 11.45 17.05L10 18.35Z" fill="#FFB693" fillOpacity="0.7" />
              </svg>
              <div>
                <h3 className="text-[20px] font-bold text-white leading-none mb-1">
                  {loading.post && !postData?.reactions ? <span className="animate-pulse">--</span> : formatNumber(likesCount)}
                </h3>
                <span className="text-[10px] font-bold tracking-widest text-[#9CA3AF] uppercase">Likes</span>
              </div>
            </div>

            {/* Shares */}
            <div className="bg-[#2A2A2A] border border-[#2A2A2A] rounded-xl p-5 flex flex-col justify-center gap-3">
              <svg width="18" height="20" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 20C14.1667 20 13.4583 19.7083 12.875 19.125C12.2917 18.5417 12 17.8333 12 17C12 16.9 12.025 16.6667 12.075 16.3L5.05 12.2C4.78333 12.45 4.475 12.6458 4.125 12.7875C3.775 12.9292 3.4 13 3 13C2.16667 13 1.45833 12.7083 0.875 12.125C0.291667 11.5417 0 10.8333 0 10C0 9.16667 0.291667 8.45833 0.875 7.875C1.45833 7.29167 2.16667 7 3 7C3.4 7 3.775 7.07083 4.125 7.2125C4.475 7.35417 4.78333 7.55 5.05 7.8L12.075 3.7C12.0417 3.58333 12.0208 3.47083 12.0125 3.3625C12.0042 3.25417 12 3.13333 12 3C12 2.16667 12.2917 1.45833 12.875 0.875C13.4583 0.291667 14.1667 0 15 0C15.8333 0 16.5417 0.291667 17.125 0.875C17.7083 1.45833 18 2.16667 18 3C18 3.83333 17.7083 4.54167 17.125 5.125C16.5417 5.70833 15.8333 6 15 6C14.6 6 14.225 5.92917 13.875 5.7875C13.525 5.64583 13.2167 5.45 12.95 5.2L5.925 9.3C5.95833 9.41667 5.97917 9.52917 5.9875 9.6375C5.99583 9.74583 6 9.86667 6 10C6 10.1333 5.99583 10.2542 5.9875 10.3625C5.97917 10.4708 5.95833 10.5833 5.925 10.7L12.95 14.8C13.2167 14.55 13.525 14.3542 13.875 14.2125C14.225 14.0708 14.6 14 15 14C15.8333 14 16.5417 14.2917 17.125 14.875C17.7083 15.4583 18 16.1667 18 17C18 17.8333 17.7083 18.5417 17.125 19.125C16.5417 19.7083 15.8333 20 15 20Z" fill="#FFB693" fillOpacity="0.7" />
              </svg>
              <div>
                <h3 className="text-[20px] font-bold text-white leading-none mb-1">
                  {loading.post && !postData?.shares ? <span className="animate-pulse">--</span> : formatNumber(sharesCount)}
                </h3>
                <span className="text-[10px] font-black tracking-widest text-[#9CA3AF] uppercase">Shares</span>
              </div>
            </div>

            {/* Comments */}
            <div className="bg-[#2A2A2A] border border-[#2A2A2A] rounded-xl p-5 flex flex-col justify-center gap-3">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 20V2C0 1.45 0.195833 0.979167 0.5875 0.5875C0.979167 0.195833 1.45 0 2 0H18C18.55 0 19.0208 0.195833 19.4125 0.5875C19.8042 0.979167 20 1.45 20 2V14C20 14.55 19.8042 15.0208 19.4125 15.4125C19.0208 15.8042 18.55 16 18 16H4L0 20ZM3.15 14H18V2H2V15.125L3.15 14ZM2 14V2V14Z" fill="#FFB693" fillOpacity="0.7" />
              </svg>
              <div>
                <h3 className="text-[20px] font-bold text-white leading-none mb-1">
                  {loading.post && !postData?.comments ? <span className="animate-pulse">--</span> : formatNumber(commentsCount)}
                </h3>
                <span className="text-[10px] font-black tracking-widest text-[#9CA3AF] uppercase">Comments</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full h-px bg-[#2A2A2A] my-2"></div>

      {/* Row 2: Detailed Post Insights */}
      <div>
        <div className="mb-4">
          <h3 className="text-[11px] font-bold tracking-[0.2em] text-[#9CA3AF] uppercase">Detailed Post Insights</h3>
        </div>

        <div className="overflow-x-auto">
        <div className="flex gap-px bg-[#2A2A2A]/20" style={{minWidth: '600px'}}>
          {/* Item 1 */}
          <div className="flex-1 min-w-[150px] bg-[#2A2A2A] p-5 px-6 rounded-l-xl">
            <span className="text-[11px] font-bold text-[#9CA3AF] uppercase block mb-1 tracking-widest whitespace-nowrap">Total Impressions</span>
            <div className="w-[32px] h-0.5 bg-[#FFB693] mb-3"></div>
            <h2 className="text-[28px] font-bold text-white leading-none mb-2">{formatNumber(impressions)}</h2>
            <span className="text-[#FFB693] text-[12px] font-medium">&mdash;</span>
          </div>

          {/* Item 2 */}
          <div className="flex-1 min-w-[150px] bg-[#2A2A2A] p-5 px-6">
            <span className="text-[11px] font-bold text-[#9CA3AF] uppercase block mb-1 tracking-widest">Reach</span>
            <div className="w-[32px] h-0.5 bg-[#FFB693] mb-3"></div>
            <h2 className="text-[28px] font-bold text-white leading-none mb-2">{formatNumber(reach)}</h2>
            <span className="text-[#FFB693] text-[12px] font-medium">{organicPct}% organic</span>
          </div>

          {/* Item 3 */}
          <div className="flex-1 min-w-[150px] bg-[#2A2A2A] p-5 px-6">
            <span className="text-[11px] font-bold text-[#9CA3AF] uppercase block mb-1 tracking-widest whitespace-nowrap">Engaged Users</span>
            <div className="w-[32px] h-0.5 bg-[#FFB693] mb-3"></div>
            <h2 className="text-[28px] font-bold text-white leading-none mb-2">{formatNumber(engagedUsers)}</h2>
            <span className="text-[#FFB693] text-[12px] font-medium">{reach > 0 ? ((engagedUsers / reach) * 100).toFixed(1) : 0}% engagement</span>
          </div>

          {/* Item 4 */}
          <div className="flex-1 min-w-[150px] bg-[#2A2A2A] p-5 px-6">
            <span className="text-[11px] font-bold text-[#9CA3AF] uppercase block mb-1 tracking-widest">Post Clicks</span>
            <div className="w-[32px] h-0.5 bg-[#FFB693] mb-3"></div>
            <h2 className="text-[28px] font-bold text-white leading-none mb-2">{formatNumber(postClicks)}</h2>
            <span className="text-[#FFB693] text-[12px] font-medium">&mdash;</span>
          </div>

          {/* Item 5 Organic vs Paid */}
          <div className="flex-[1.5] min-w-[200px] bg-[#2A2A2A] p-5 px-6 flex flex-col justify-center rounded-r-xl">
            <span className="text-[11px] font-bold text-[#9CA3AF] uppercase block mb-1 tracking-widest whitespace-nowrap">Organic Vs Paid Reach</span>
            <div className="w-[32px] h-0.5 bg-[#FFB693] mb-3"></div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1.5 text-[11px] font-bold text-[#9CA3AF] uppercase">
                  <span>Organic</span>
                  <span>{organicPct}%</span>
                </div>
                <div className="h-2 w-full bg-[#0E0E0E] rounded-full overflow-hidden">
                  <div className="h-full bg-[#FFB693]" style={{ width: `${organicPct}%` }}></div>
                </div>
              </div>

              <div className="flex-1">
                <div className="flex justify-between items-center mb-1.5 text-[11px] font-bold text-[#9CA3AF] uppercase">
                  <span>Paid</span>
                  <span>{paidPct}%</span>
                </div>
                <div className="h-2 w-full bg-[#0E0E0E] rounded-full overflow-hidden">
                  <div className="h-full bg-[#5A4136]" style={{ width: `${paidPct}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Row 3: Reactions Breakdown */}
      <div className="bg-[#0E0E0E] border border-[#5A41361A] rounded-xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="shrink-0">
          <span className="text-[11px] font-bold tracking-[0.2em] text-[#9CA3AF] uppercase block mb-2">Reactions Breakdown</span>
          <div className="flex items-baseline gap-2">
            <h2 className="text-[28px] font-bold text-white leading-none">{formatNumber(totalReactions)}</h2>
            <span className="text-[18px] font-medium text-white/90">Total</span>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto pb-2">
          {/* Like */}
          <div className="flex flex-col items-center gap-2">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" rx="12" fill="#1877F2" /><path d="M24.125 27.5H16.625V17.75L21.875 12.5L22.8125 13.4375C22.9 13.525 22.9719 13.6438 23.0281 13.7938C23.0844 13.9438 23.1125 14.0875 23.1125 14.225V14.4875L22.2875 17.75H26.375C26.775 17.75 27.125 17.9 27.425 18.2C27.725 18.5 27.875 18.85 27.875 19.25V20.75C27.875 20.8375 27.8656 20.9312 27.8469 21.0312C27.8281 21.1313 27.8 21.225 27.7625 21.3125L25.5125 26.6C25.4 26.85 25.2125 27.0625 24.95 27.2375C24.6875 27.4125 24.4125 27.5 24.125 27.5ZM15.125 17.75V27.5H12.125V17.75H15.125Z" fill="white" /></svg>
            <div className="text-center">
              <span className="block text-white font-bold text-[13px] leading-tight">{formatNumber(reactionTotals['LIKE'] || 0)}</span>
              <span className="block text-[#9CA3AF] text-[9px] font-bold tracking-widest uppercase mt-0.5">Like</span>
            </div>
          </div>

          {/* Love */}
          <div className="flex flex-col items-center gap-2">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" rx="12" fill="#F33E58" /><path d="M20 26.8813L18.9125 25.9063C17.65 24.7688 16.6062 23.7875 15.7812 22.9625C14.9562 22.1375 14.3 21.3969 13.8125 20.7406C13.325 20.0844 12.9844 19.4813 12.7906 18.9313C12.5969 18.3813 12.5 17.8188 12.5 17.2438C12.5 16.0688 12.8937 15.0875 13.6812 14.3C14.4688 13.5125 15.45 13.1188 16.625 13.1188C17.275 13.1188 17.8937 13.2563 18.4812 13.5313C19.0687 13.8063 19.575 14.1938 20 14.6938C20.425 14.1938 20.9313 13.8063 21.5188 13.5313C22.1062 13.2563 22.725 13.1188 23.375 13.1188C24.55 13.1188 25.5312 13.5125 26.3188 14.3C27.1063 15.0875 27.5 16.0688 27.5 17.2438C27.5 17.8188 27.4031 18.3813 27.2094 18.9313C27.0156 19.4813 26.675 20.0844 26.1875 20.7406C25.7 21.3969 25.0437 22.1375 24.2188 22.9625C23.3938 23.7875 22.35 24.7688 21.0875 25.9063L20 26.8813Z" fill="white" /></svg>
            <div className="text-center">
              <span className="block text-white font-bold text-[13px] leading-tight">{formatNumber(reactionTotals['LOVE'] || 0)}</span>
              <span className="block text-[#9CA3AF] text-[9px] font-bold tracking-widest uppercase mt-0.5">Love</span>
            </div>
          </div>

          {/* Haha */}
          <div className="flex flex-col items-center gap-2">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" rx="12" fill="#F7B125" /><path d="M22.625 19.25C... 25.9812 23.8375 26.5156 22.925 26.9094C22.0125 27.3031 21.0375 27.5 20 27.5Z" fill="white" /><ellipse cx="17.5" cy="18" rx="1.5" ry="2" fill="white" /><ellipse cx="22.5" cy="18" rx="1.5" ry="2" fill="white" /><path d="M16 22C16 22 18 25 20 25C22 25 24 22 24 22" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
            <div className="text-center">
              <span className="block text-white font-bold text-[13px] leading-tight">{formatNumber(reactionTotals['HAHA'] || 0)}</span>
              <span className="block text-[#9CA3AF] text-[9px] font-bold tracking-widest uppercase mt-0.5">Haha</span>
            </div>
          </div>

          {/* Wow */}
          <div className="flex flex-col items-center gap-2">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" rx="12" fill="#F7B125" /><circle cx="20" cy="20" r="7.5" stroke="white" strokeWidth="2" /><circle cx="17.5" cy="17" r="1.5" fill="white" /><circle cx="22.5" cy="17" r="1.5" fill="white" /><circle cx="20" cy="23" r="2" fill="white" /></svg>
            <div className="text-center">
              <span className="block text-white font-bold text-[13px] leading-tight">{formatNumber(reactionTotals['WOW'] || 0)}</span>
              <span className="block text-[#9CA3AF] text-[9px] font-bold tracking-widest uppercase mt-0.5">Wow</span>
            </div>
          </div>

          {/* Sad */}
          <div className="flex flex-col items-center gap-2">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" rx="12" fill="#F7B125" /><circle cx="20" cy="20" r="7.5" stroke="white" strokeWidth="2" /><circle cx="17.5" cy="18" r="1.5" fill="white" /><circle cx="22.5" cy="18" r="1.5" fill="white" /><path d="M17 24C17 24 18.5 22 20 22C21.5 22 23 24 23 24" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
            <div className="text-center">
              <span className="block text-white font-bold text-[13px] leading-tight">{formatNumber(reactionTotals['SAD'] || 0)}</span>
              <span className="block text-[#9CA3AF] text-[9px] font-bold tracking-widest uppercase mt-0.5">Sad</span>
            </div>
          </div>

          {/* Angry */}
          <div className="flex flex-col items-center gap-2">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" rx="12" fill="#E9710F" /><circle cx="20" cy="20" r="7.5" stroke="white" strokeWidth="2" /><path d="M16 16L18 18M24 16L22 18" stroke="white" strokeWidth="2" strokeLinecap="round" /><circle cx="17.5" cy="19" r="1.5" fill="white" /><circle cx="22.5" cy="19" r="1.5" fill="white" /><path d="M17 24C17 24 18.5 23 20 23C21.5 23 23 24 23 24" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>
            <div className="text-center">
              <span className="block text-white font-bold text-[13px] leading-tight">{formatNumber(reactionTotals['ANGRY'] || 0)}</span>
              <span className="block text-[#9CA3AF] text-[9px] font-bold tracking-widest uppercase mt-0.5">Angry</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Two Analytics Divs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Click Breakdown */}
        <div className="bg-[#2A2A2A] border border-[#2A2A2A] rounded-xl p-8">
          <span className="text-[11px] font-bold tracking-[0.2em] text-[#9CA3AF] uppercase block mb-8">Click Breakdown</span>

          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1">
                <div className="text-[11px] font-bold uppercase text-white mb-2">Link Clicks</div>
                <div className="h-2 w-full bg-[#0E0E0E] rounded-full overflow-hidden">
                  <div className="h-full bg-[#FFB693]" style={{ width: `${linkPct}%` }}></div>
                </div>
              </div>
              <div className="text-right mt-4 w-20">
                <span className="block text-[24px] font-bold text-white leading-none">{formatNumber(linkClicks)}</span>
                <span className="block text-[9px] font-bold text-[#9CA3AF] tracking-widest uppercase mt-1">Visit Intersects</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-6">
              <div className="flex-1">
                <div className="text-[11px] font-bold uppercase text-white mb-2">Photo Views</div>
                <div className="h-2 w-full bg-[#0E0E0E] rounded-full overflow-hidden">
                  <div className="h-full bg-[#FFB69399]" style={{ width: `${photoPct}%` }}></div>
                </div>
              </div>
              <div className="text-right mt-4 w-20">
                <span className="block text-[24px] font-bold text-white leading-none">{formatNumber(photoViews)}</span>
                <span className="block text-[9px] font-bold text-[#9CA3AF] tracking-widest uppercase mt-1">Gallery Engagement</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-6">
              <div className="flex-1">
                <div className="text-[11px] font-bold uppercase text-white mb-2">Other Clicks</div>
                <div className="h-2 w-full bg-[#0E0E0E] rounded-full overflow-hidden">
                  <div className="h-full bg-[#5A4136]" style={{ width: `${otherPct}%` }}></div>
                </div>
              </div>
              <div className="text-right mt-4 w-20">
                <span className="block text-[24px] font-bold text-white leading-none">{formatNumber(otherClicks)}</span>
                <span className="block text-[9px] font-bold text-[#9CA3AF] tracking-widest uppercase mt-1">Profile / Tap. Clicks</span>
              </div>
            </div>
          </div>
        </div>

        {/* Video Retention */}
        <div className="bg-[#2A2A2A] border border-[#2A2A2A] rounded-xl p-8 flex flex-col justify-between">
          <span className="text-[11px] font-bold tracking-[0.2em] text-[#9CA3AF] uppercase block mb-8">Video Retention (If Applicable)</span>

          <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-8">
            <div>
              <span className="text-[10px] font-bold tracking-widest text-[#9CA3AF] uppercase block mb-1">3S Video Views</span>
              <span className="text-[28px] font-bold text-white leading-none">{formatNumber(videoViews3s)}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-widest text-[#9CA3AF] uppercase block mb-1">10S Video Views</span>
              <span className="text-[28px] font-bold text-white leading-none">{formatNumber(videoViews1m)}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-widest text-[#9CA3AF] uppercase block mb-1">Avg Watch Time</span>
              <span className="text-[28px] font-bold text-white leading-none">{fmtWatchTime(avgWatch)}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-widest text-[#9CA3AF] uppercase block mb-1">Retention Rate</span>
              <span className="text-[28px] font-bold text-white leading-none">{retentionRate}</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-bold tracking-widest text-[#9CA3AF] uppercase block mb-4">Audience Retention Curve</span>
            <div className="w-full h-24 flex items-end gap-1 px-1 opacity-90">
              {(retentionData.length > 0 ? retentionData : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).map((val, i, arr) => (
                <div
                  key={i}
                  className="flex-1 bg-[#FFB693] transition-all duration-500"
                  style={{
                    height: `${Math.max(val, 2)}%`,
                    opacity: 0.3 + (0.7 * (val / 100)),
                    borderTopLeftRadius: '1px',
                    borderTopRightRadius: '1px'
                  }}
                  title={`${val}% retention`}
                ></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="text-center pt-8 pb-4">
        <span className="text-[10px] font-bold tracking-widest text-[#9CA3AF] uppercase">NewsBomb Analytics Engine v4.2.1 • Meta Verified Connector</span>
      </div>

    </div>
  );
}
