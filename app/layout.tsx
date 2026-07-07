import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// 1. IMPORT SPLASH SCREEN
import SplashScreen from "@/components/SplashScreen";
// 2. IMPORT MESIN BAHASA (CONTEXT)
import { LanguageProvider } from '@/context/LanguageContext';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bri9 App",
  description: "Asisten Keuangan & Jurnal Kendaraan",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        
        {/* 3. BUNGKUS SELURUH APLIKASI DENGAN LANGUAGE PROVIDER */}
        <LanguageProvider>
          
          {/* Splash Screen tetap berjalan normal di layer teratas */}
          <SplashScreen />
          
          {children}
          
        </LanguageProvider>

      </body>
    </html>
  );
}