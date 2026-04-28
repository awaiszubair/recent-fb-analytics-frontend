import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import { Inter } from 'next/font/google';
import StoreProvider from './StoreProvider';
import RootLayoutInner from './RootLayoutInner';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
});

export const metadata = {
  title: "FB Analytics Dashboard",
  description: "Manage and sync your Facebook Page data.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.className}>
      <body className={`antialiased bg-[#0A0A0A] text-[#9CA3AF]`}>
        <StoreProvider>
          <RootLayoutInner>
            {children}
          </RootLayoutInner>
        </StoreProvider>
      </body>
    </html>
  );
}
