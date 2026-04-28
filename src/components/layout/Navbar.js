"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Search, Menu } from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import { useRouter } from "next/navigation";
import { fetchAccountPagesOnly, fetchUserProfile } from "@/store/slices/metaSlice";

export default function Navbar({ onMenuClick }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const { userProfile, userAccessToken, isConnected, accountData } = useSelector(s => s.meta);

  useEffect(() => {
    if (isConnected && userAccessToken && !userProfile) {
      dispatch(fetchUserProfile({ accessToken: userAccessToken }));
    }
  }, [isConnected, userAccessToken, userProfile, dispatch]);

  useEffect(() => {
    if (isConnected && userAccessToken && !accountData?.pages?.length) {
      dispatch(fetchAccountPagesOnly({ accessToken: userAccessToken }));
    }
  }, [isConnected, userAccessToken, accountData?.pages?.length, dispatch]);

  const initials = userProfile?.name 
    ? userProfile.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "AE";

  const matchingPages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];

    return (accountData?.pages || [])
      .filter((page) =>
        [page.name, page.category]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      )
      .slice(0, 6);
  }, [accountData?.pages, searchQuery]);

  const handleNavigate = (pageId) => {
    if (!pageId) return;
    setSearchQuery("");
    setIsFocused(false);
    router.push(`/analytics/${pageId}`);
  };

  const handleSubmit = (event) => {
    if (event.key !== "Enter") return;
    const firstMatch = matchingPages[0];
    if (firstMatch?.id) {
      handleNavigate(firstMatch.id);
    }
  };

  return (
    <header className="h-[64px] lg:h-[76px] bg-[#131313] border-b border-[#2A2A2A] flex items-center justify-between px-4 lg:px-8 shrink-0 gap-3">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-[#1A1A1A] transition-colors shrink-0"
        aria-label="Open sidebar"
      >
        <Menu size={20} />
      </button>

      {/* Search bar */}
      <div className="flex-1 max-w-[420px] relative mt-0.5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={16} />
        <input 
          type="text" 
          placeholder="Search..." 
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          onKeyDown={handleSubmit}
          className="w-full h-10 lg:h-11 bg-[#1C1B1B] rounded-lg pl-10 pr-4 text-[14px] lg:text-[15px] text-white placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#FF6B00] border border-transparent focus:border-[#FF6B00]/30 transition-all"
        />
        {isFocused && searchQuery.trim() && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg shadow-xl overflow-hidden z-30">
            {matchingPages.length > 0 ? matchingPages.map((page) => (
              <button
                key={page.id}
                onClick={() => handleNavigate(page.id)}
                className="w-full text-left px-4 py-3 hover:bg-[#202020] transition-colors"
              >
                <span className="block text-white text-[14px] font-medium">{page.name}</span>
                <span className="block text-[#9CA3AF] text-[12px]">{page.category || "Connected Page"}</span>
              </button>
            )) : (
              <div className="px-4 py-3 text-[#9CA3AF] text-[13px]">No matching pages found.</div>
            )}
          </div>
        )}
      </div>
      
      {/* Right section */}
      <div className="flex items-center gap-3 lg:gap-6 shrink-0">
        {/* Icons — hidden on very small screens */}
        <div className="hidden sm:flex items-center gap-5 lg:gap-8">
          <button className="relative text-[#E5E2E1] hover:text-white transition-colors group">
            <svg width="18" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="group-hover:scale-110 transition-transform">
              <path d="M0 17V15H2V8C2 6.61667 2.41667 5.3875 3.25 4.3125C4.08333 3.2375 5.16667 2.53333 6.5 2.2V1.5C6.5 1.08333 6.64583 0.729167 6.9375 0.4375C7.22917 0.145833 7.58333 0 8 0C8.41667 0 8.77083 0.145833 9.0625 0.4375C9.35417 0.729167 9.5 1.08333 9.5 1.5V2.2C10.8333 2.53333 11.9167 3.2375 12.75 4.3125C13.5833 5.3875 14 6.61667 14 8V15H16V17H0ZM8 20C7.45 20 6.97917 19.8042 6.5875 19.4125C6.19583 19.0208 6 18.55 6 18H10C10 18.55 9.80417 19.0208 9.4125 19.4125C9.02083 19.8042 8.55 20 8 20ZM4 15H12V8C12 6.9 11.6083 5.95833 10.825 5.175C10.0417 4.39167 9.1 4 8 4C6.9 4 5.95833 4.39167 5.175 5.175C4.39167 5.95833 4 6.9 4 8V15Z" fill="currentColor"/>
            </svg>
            <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-[#FF6B00] rounded-full border-2 border-[#131313]"></span>
          </button>
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#E5E2E1] hover:text-white cursor-pointer hover:scale-110 transition-transform">
            <path d="M9.95 16C10.3 16 10.5958 15.8792 10.8375 15.6375C11.0792 15.3958 11.2 15.1 11.2 14.75C11.2 14.4 11.0792 14.1042 10.8375 13.8625C10.5958 13.6208 10.3 13.5 9.95 13.5C9.6 13.5 9.30417 13.6208 9.0625 13.8625C8.82083 14.1042 8.7 14.4 8.7 14.75C8.7 15.1 8.82083 15.3958 9.0625 15.6375C9.30417 15.8792 9.6 16 9.95 16ZM9.05 12.15H10.9C10.9 11.6 10.9625 11.1667 11.0875 10.85C11.2125 10.5333 11.5667 10.1 12.15 9.55C12.5833 9.11667 12.925 8.70417 13.175 8.3125C13.425 7.92083 13.55 7.45 13.55 6.9C13.55 5.96667 13.2083 5.25 12.525 4.75C11.8417 4.25 11.0333 4 10.1 4C9.15 4 8.37917 4.25 7.7875 4.75C7.19583 5.25 6.78333 5.85 6.55 6.55L8.2 7.2C8.28333 6.9 8.47083 6.575 8.7625 6.225C9.05417 5.875 9.5 5.7 10.1 5.7C10.6333 5.7 11.0333 5.84583 11.3 6.1375C11.5667 6.42917 11.7 6.75 11.7 7.1C11.7 7.43333 11.6 7.74583 11.4 8.0375C11.2 8.32917 10.95 8.6 10.65 8.85C9.91667 9.5 9.46667 9.99167 9.3 10.325C9.13333 10.6583 9.05 11.2667 9.05 12.15ZM10 20C8.61667 20 7.31667 19.7375 6.1 19.2125C4.88333 18.6875 3.825 17.975 2.925 17.075C2.025 16.175 1.3125 15.1167 0.7875 13.9C0.2625 12.6833 0 11.3833 0 10C0 8.61667 0.2625 7.31667 0.7875 6.1C1.3125 4.88333 2.025 3.825 2.925 2.925C3.825 2.025 4.88333 1.3125 6.1 0.7875C7.31667 0.2625 8.61667 0 10 0C11.3833 0 12.6833 0.2625 13.9 0.7875C15.1167 1.3125 16.175 2.025 17.075 2.925C17.975 3.825 18.6875 4.88333 19.2125 6.1C19.7375 7.31667 20 8.61667 20 10C20 11.3833 19.7375 12.6833 19.2125 13.9C18.6875 15.1167 17.975 16.175 17.075 17.075C16.175 17.975 15.1167 18.6875 13.9 19.2125C12.6833 19.7375 11.3833 20 10 20ZM10 18C12.2333 18 14.125 17.225 15.675 15.675C17.225 14.125 18 12.2333 18 10C18 7.76667 17.225 5.875 15.675 4.325C14.125 2.775 12.2333 2 10 2C7.76667 2 5.875 2.775 4.325 4.325C2.775 5.875 2 7.76667 2 10C2 12.2333 2.775 14.125 4.325 15.675C5.875 17.225 7.76667 18 10 18Z" fill="currentColor"/>
          </svg>
        </div>
        
        <div className="hidden sm:block w-px h-8 bg-[#2A2A2A]"></div>
        
        {/* User avatar + name */}
        <div className="flex items-center gap-2 lg:gap-3 cursor-pointer group">
          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg bg-gradient-to-br from-[#FF6B00] to-[#FF9B50] flex items-center justify-center overflow-hidden shadow-sm group-hover:shadow-md transition-shadow shrink-0">
            {userProfile?.picture ? (
              <img src={userProfile.picture} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-semibold text-sm">{initials}</span>
            )}
          </div>
          {/* Name — hidden on small screens */}
          <div className="hidden md:flex flex-col">
            <span className="text-white text-[15px] font-bold leading-tight">
              {userProfile?.name || "Not Logged In"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
