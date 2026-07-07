"use client";
import React from 'react';
import Link from 'next/link';

interface NavbarProps {
  activeMenu: 'home' | 'analytics' | 'history' | 'settings';
}

export default function Navbar({ activeMenu }: NavbarProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1c1c1e]/60 backdrop-blur-xl px-8 py-4 rounded-[2rem] flex justify-between items-center w-[90%] max-w-[360px] border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)] z-50">
      
      {/* 1. Home */}
      <Link href="/">
        <button className={`hover:scale-110 transition-all ${activeMenu === 'home' ? 'text-white drop-shadow-md' : 'text-gray-500 hover:text-white'}`}>
          <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
        </button>
      </Link>
      
      {/* 2. Analytics */}
      <Link href="/analytics">
        <button className={`hover:scale-110 transition-all ${activeMenu === 'analytics' ? 'text-white drop-shadow-md' : 'text-gray-500 hover:text-white'}`}>
          <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>
        </button>
      </Link>
      
      {/* 3. History */}
      <Link href="/history">
        <button className={`hover:scale-110 transition-all ${activeMenu === 'history' ? 'text-white drop-shadow-md' : 'text-gray-500 hover:text-white'}`}>
          <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z"/></svg>
        </button>
      </Link>
      
      {/* 4. Settings */}
      <Link href="/settings">
        <button className={`hover:scale-110 transition-all ${activeMenu === 'settings' ? 'text-white drop-shadow-md' : 'text-gray-500 hover:text-white'}`}>
          <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 C13.96,21.83,14.15,22,14.4,22h3.84c0.24,0,0.43-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>
        </button>
      </Link>
    </div>
  );
}