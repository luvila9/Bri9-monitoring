"use client";
import React, { useState, useEffect } from 'react';

export default function SplashScreen() {
  const [show, setShow] = useState(true);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    // Mulai memudar (fade out) di detik ke-2
    const fadeTimer = setTimeout(() => setFade(true), 2000);
    // Hapus sepenuhnya dari layar di detik ke-2.5
    const removeTimer = setTimeout(() => setShow(false), 2500);
    
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!show) return null;

  return (
    <div className={`fixed inset-0 z-[99999] bg-[#050505] flex flex-col items-center justify-center transition-opacity duration-500 ease-in-out ${fade ? 'opacity-0' : 'opacity-100'}`}>
      
      <div className="relative flex flex-col items-center justify-center">
        {/* Glow Latar Belakang Halus (Biru Gelap) */}
        <div className="absolute w-48 h-48 bg-blue-600/10 rounded-full blur-3xl animate-pulse"></div>
        
        {/* Kotak Logo "Bri9" */}
        <div className="relative z-10 w-28 h-28 bg-[#1c1c1e] rounded-[1.75rem] shadow-2xl border border-white/5 flex items-center justify-center transform hover:scale-105 transition-transform">
          <span className="text-4xl font-black tracking-tight">
            <span className="text-white">Bri</span><span className="text-gray-400">9</span>
          </span>
        </div>
      </div>
      
      {/* Indikator Loading di Bawah */}
      <div className="absolute bottom-20 flex flex-col items-center">
         <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
            <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
         </div>
      </div>

    </div>
  );
}