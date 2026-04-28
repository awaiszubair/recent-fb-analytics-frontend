"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle, LogOut, X } from "lucide-react";
import { useDispatch } from "react-redux";
import { logoutFacebook } from "@/store/slices/metaSlice";
import { useRouter } from "next/navigation";

export default function Sidebar({ open = false, onClose }) {
  const pathname = usePathname();
  const dispatch = useDispatch();
  const router = useRouter();

  const handleLogout = () => {
    dispatch(logoutFacebook());
    if (onClose) onClose();
    router.push("/");
  };

  const menuItems = [
    {
      name: "Analytics",
      path: "/",
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7.5 15.8333V10.8333C7.5 9.91286 6.75381 9.16667 5.83333 9.16667H4.16667C3.24619 9.16667 2.5 9.91286 2.5 10.8333V15.8333C2.5 16.7538 3.24619 17.5 4.16667 17.5H5.83333C6.75381 17.5 7.5 16.7538 7.5 15.8333V15.8333M7.5 15.8333V7.5C7.5 6.57953 8.24619 5.83333 9.16667 5.83333H10.8333C11.7538 5.83333 12.5 6.57953 12.5 7.5V15.8333M7.5 15.8333C7.5 16.7538 8.24619 17.5 9.16667 17.5H10.8333C11.7538 17.5 12.5 16.7538 12.5 15.8333M12.5 15.8333V4.16667C12.5 3.24619 13.2462 2.5 14.1667 2.5H15.8333C16.7538 2.5 17.5 3.24619 17.5 4.16667V15.8333C17.5 16.7538 16.7538 17.5 15.8333 17.5H14.1667C13.2462 17.5 12.5 16.7538 12.5 15.8333H7.5" stroke={active ? "#FF6B00" : "#9CA3AF"} strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    },
    {
      name: "Connected Pages",
      path: "/connected-pages",
      icon: (active) => (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9.10833 15.6058L8.19 16.5233C7.35309 17.3899 6.11374 17.7374 4.94831 17.4323C3.78288 17.1273 2.87273 16.2171 2.56768 15.0517C2.26263 13.8863 2.61015 12.6469 3.47667 11.81L6.81 8.47667C8.11167 7.1754 10.2217 7.1754 11.5233 8.47667L11.6992 9.31084M8.47667 11.5842L8.535 7.70167C9.37192 6.83515 10.6113 6.48763 11.7767 6.79268C12.9421 7.09773 13.8523 8.00788 14.1573 9.17331C14.4624 10.3387 14.1149 11.5781 13.2483 12.415L12.3308 13.3325" stroke={active ? "#FF6B00" : "#9CA3AF"} strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )
    }
  ];

  return (
    <aside
      className={`
        fixed lg:relative z-40 lg:z-auto
        w-[280px] h-screen bg-[#131313] flex flex-col border-r border-[#2A2A2A]
        transition-transform duration-300 ease-in-out
        ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}
    >
      <div className="p-6 pb-2 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 w-fit group" onClick={onClose}>
          <div className="w-8 h-8 rounded-full bg-[#FF6B00] flex items-center justify-center font-bold text-white shadow-lg shadow-[#FF6B00]/20 group-hover:scale-105 transition-transform">
            FB
          </div>
          <span className="text-white font-semibold text-lg tracking-wide group-hover:text-[#FF6B00] transition-colors">FB Analytics</span>
        </Link>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-[#1A1A1A] transition-colors"
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </div>
      
      <div className="flex-1 mt-[50px] px-4 space-y-1.5">
        {menuItems.map((item) => {
          const isActive = item.path === '/' 
            ? pathname === '/' || pathname.startsWith('/analytics') 
            : pathname.startsWith(item.path);
          
          return (
            <Link 
              key={item.path} 
              href={item.path}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive ? "bg-[#1A1A1A] text-white shadow-sm" : "text-[#9CA3AF] hover:text-white hover:bg-[#1A1A1A]/50"
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center">
                {item.icon(isActive)}
              </div>
              <span className={`text-[15px] ${isActive ? 'font-medium' : 'font-normal'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="border-t border-[#2A2A2A] p-4 space-y-1.5 mb-2 mx-4">
        <a href="mailto:ai-ops@publisherinabox.com?subject=FB%20Analytics%20Support%20Query" className="flex items-center gap-3 px-4 py-3 rounded-lg w-full text-[#9CA3AF] hover:text-white hover:bg-[#1A1A1A]/50 transition-all duration-200">
          <HelpCircle size={18} strokeWidth={1.75} />
          <span className="text-[15px]">Support</span>
        </a>
        <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-lg w-full text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-all duration-200">
          <LogOut size={18} strokeWidth={1.75} />
          <span className="text-[15px]">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
