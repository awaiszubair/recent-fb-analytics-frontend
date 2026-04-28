"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, ChevronDown, CheckCircle } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import FacebookAuthButton from "@/components/FacebookAuthButton";
import { fetchAccountData, fetchAccountPagesOnly } from "@/store/slices/metaSlice";
import { formatNumber } from "@/lib/metricUtils";

const formatSyncTime = (timestamp) => {
  if (!timestamp) return "Not synced yet";

  const diffMs = Date.now() - new Date(timestamp).getTime();

  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return "Synced recently";
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return "Synced Just Now";
  if (diffMinutes < 60) return `Synced ${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Synced ${diffHours} hr ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `Synced ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
};

export default function ConnectedPages() {
  const dispatch = useDispatch();
  const [sortOpen, setSortOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [selectedSort, setSelectedSort] = useState("Newest");
  const [selectedStatus, setSelectedStatus] = useState("All Pages");
  const [connectTrigger, setConnectTrigger] = useState(null);

  const { userAccessToken, isConnected, accountData, loading } = useSelector((state) => state.meta);

  useEffect(() => {
    if (isConnected && userAccessToken && !accountData) {
      dispatch(fetchAccountPagesOnly({ accessToken: userAccessToken }));
      dispatch(fetchAccountData({ accessToken: userAccessToken }));
    }
  }, [isConnected, userAccessToken, accountData, dispatch]);

  // Use the fetched pages or fallback to mock if the user isn't connected or we have no data yet
  const pages = isConnected && accountData?.pages ? accountData.pages.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category || "Media / News",
    avatarPath: p.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=FF6B00&color=fff`,
    rawFollowers: Number(p.followers || 0),
    followers: formatNumber(p.followers),
    isMonetized: (p.metrics?.content_monetization_earnings ?? 0) > 0 || (p.metrics?.monetization_approximate_earnings ?? 0) > 0,
    latestSyncCompletedAt: p.latest_sync_completed_at || null,
    syncTime: formatSyncTime(p.latest_sync_completed_at),
  })) : [];

  const filteredPages = pages
    .filter((page) => {
      if (selectedStatus === "Monetized") return page.isMonetized;
      if (selectedStatus === "Non Monetized") return !page.isMonetized;
      return true;
    })
    .sort((a, b) => {
      const aTime = a.latestSyncCompletedAt ? new Date(a.latestSyncCompletedAt).getTime() : 0;
      const bTime = b.latestSyncCompletedAt ? new Date(b.latestSyncCompletedAt).getTime() : 0;
      return selectedSort === "Oldest" ? aTime - bTime : bTime - aTime;
    });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto flex flex-col gap-5 sm:gap-6">
      <div className="flex items-center gap-3 -mb-2">
        <Link href="/" className="text-[#9CA3AF] text-[13px] font-bold tracking-widest uppercase hover:text-white transition-colors">
          &larr; BACK TO DASHBOARD
        </Link>
      </div>

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">Connected Pages</h1>
          <p className="text-[#9CA3AF] text-[14px] sm:text-[15px]">Manage and sync your Facebook Page data.</p>
        </div>

        {/* Dynamic App Integration / Auth Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <FacebookAuthButton className="hidden" onTriggerReady={setConnectTrigger} />
          {!isConnected ? (
            <FacebookAuthButton />
          ) : (
            <>
              <div className="flex items-center px-4 py-2.5 rounded-lg bg-[#10B981]/10 text-[#10B981] font-medium border border-[#10B981]/20 gap-2 text-[14px]">
                <CheckCircle size={16} />
                Facebook Connected
              </div>
              <button
                onClick={() => connectTrigger?.()}
                disabled={!connectTrigger}
                className={`flex items-center gap-2 bg-[#FF6B00] hover:bg-[#FF8533] text-white px-5 py-2.5 rounded-lg font-medium transition-colors ${!connectTrigger ? "opacity-70 cursor-not-allowed" : ""}`}
                style={{
                  boxShadow: "0px 4px 6px -4px rgba(124, 45, 18, 0.2), 0px 10px 15px -3px rgba(124, 45, 18, 0.2)"
                }}>
                <Plus size={18} strokeWidth={2.5} />
                <span>Connect new page</span>
              </button>
            </>
          )}
        </div>
      </div>

      {!isConnected ? (
        <div className="h-[400px] flex flex-col items-center justify-center bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] mt-4">
          <div className="w-16 h-16 rounded-full bg-[#1A1A1A] border-2 border-[#3A3A3A] flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#6B7280"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
          </div>
          <h3 className="text-xl font-medium text-white mb-2">Connect to Facebook</h3>
          <p className="text-[#9CA3AF] text-[14px] max-w-sm text-center mb-6">Authorize your Meta account to instantly sync your Pages and unlock consolidated reach and earnings analytics.</p>
          <FacebookAuthButton />
        </div>
      ) : loading.account ? (
        <div className="h-[400px] flex items-center justify-center bg-[#1A1A1A] rounded-xl border border-[#2A2A2A]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      ) : (
        <>
          {/* Filters Row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <div onClick={() => setSortOpen(!sortOpen)} className="bg-[#1A1A1A] rounded-lg px-4 py-2.5 flex items-center justify-between min-w-[180px] cursor-pointer hover:bg-[#202020] transition-colors border border-transparent hover:border-[#2A2A2A]">
                <span className="text-[14px]">
                  <span className="text-[#9CA3AF]">Sort by: </span>
                  <span className="text-white font-medium">{selectedSort}</span>
                </span>
                <ChevronDown size={16} className="text-[#9CA3AF]" />
              </div>
              {sortOpen && (
                <div className="absolute top-full left-0 mt-2 w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-xl z-20 py-1 overflow-hidden">
                  {["Newest", "Oldest"].map((option) => (
                    <div
                      key={option}
                      onClick={() => {
                        setSelectedSort(option);
                        setSortOpen(false);
                      }}
                      className={`px-4 py-2 hover:bg-[#202020] cursor-pointer text-[14px] ${selectedSort === option ? "text-white" : "text-[#9CA3AF] hover:text-white"}`}
                    >
                      {option}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <div onClick={() => setStatusOpen(!statusOpen)} className="bg-[#1A1A1A] rounded-lg px-4 py-2.5 flex items-center justify-between min-w-[180px] cursor-pointer hover:bg-[#202020] transition-colors border border-transparent hover:border-[#2A2A2A]">
                <span className="text-[14px]">
                  <span className="text-[#9CA3AF]">Status: </span>
                  <span className="text-white font-medium">{selectedStatus}</span>
                </span>
                <ChevronDown size={16} className="text-[#9CA3AF]" />
              </div>
              {statusOpen && (
                <div className="absolute top-full left-0 mt-2 w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-xl z-20 py-1 overflow-hidden">
                  {["All Pages", "Monetized", "Non Monetized"].map((option) => (
                    <div
                      key={option}
                      onClick={() => {
                        setSelectedStatus(option);
                        setStatusOpen(false);
                      }}
                      className={`px-4 py-2 hover:bg-[#202020] cursor-pointer text-[14px] ${selectedStatus === option ? "text-white" : "text-[#9CA3AF] hover:text-white"}`}
                    >
                      {option}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Table Row */}
          <div className="bg-[#1A1A1A] overflow-hidden border border-[#2A2A2A] rounded-xl text-[14px]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[580px]">
                <thead>
                  <tr className="border-b border-[#2A2A2A] bg-transparent">
                    <th className="py-4 px-6 font-medium text-[#9CA3AF] w-2/5 whitespace-nowrap">Page</th>
                    <th className="py-4 px-6 font-medium text-[#9CA3AF] whitespace-nowrap">Followers</th>
                    <th className="py-4 px-6 font-medium text-[#9CA3AF] whitespace-nowrap">Monetization</th>
                    <th className="py-4 px-6 font-medium text-[#9CA3AF] whitespace-nowrap">Sync Status</th>
                    <th className="py-4 px-6 font-medium text-[#9CA3AF] whitespace-nowrap text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPages.map((page, index) => (
                    <tr
                      key={page.id}
                      className={`group ${index !== filteredPages.length - 1 ? "border-b border-[#2A2A2A]" : ""} hover:bg-[#131313]/50 transition-colors`}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-4">
                          <img
                            src={page.avatarPath}
                            alt={page.name}
                            className="w-11 h-11 rounded-full shadow-sm"
                          />
                          <div className="flex flex-col gap-0.5">
                            <span className="text-white font-medium">{page.name}</span>
                            <span className="text-[#9CA3AF] text-[13px]">{page.category}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-[#9CA3AF] font-medium">{page.followers}</td>
                      <td className="py-4 px-6">
                        {page.isMonetized ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[13px] font-medium text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20">
                            Monetized
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[13px] font-medium text-[#9CA3AF] bg-[#6B7280]/10 border border-[#6B7280]/20">
                            Non Monetized
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 text-[#9CA3AF]">
                          <div className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                          <span className="text-[13px]">{page.syncTime}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          href={`/analytics/${page.id}`}
                          className="text-[#FF6B00] font-medium hover:text-[#FF8533] transition-colors underline-offset-4 hover:underline"
                        >
                          View Analytics
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {filteredPages.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-12 px-6 text-center text-[#9CA3AF]">
                        No pages match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
