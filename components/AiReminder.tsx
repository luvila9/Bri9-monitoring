"use client";
import React, { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import Link from 'next/link';

export default function AiReminder() {
   const [showNotif, setShowNotif] = useState(false);
   const [aiMessage, setAiMessage] = useState("Mengecek status jurnalmu hari ini...");
   const [isVisible, setIsVisible] = useState(true);
   
   useEffect(() => {
      const unsub = onAuthStateChanged(auth, async (user) => {
         if (user) {
            const userName = localStorage.getItem('bri9_username') || user.email?.split('@')[0] || 'Ubaidullah';
            
            // 1. CEK DATABASE: Apakah ada jurnal hari ini?
            const q = query(collection(db, "life_journal"), where("userId", "==", user.uid), orderBy("createdAt", "desc"), limit(1));
            const snapshot = await getDocs(q);
            
            let hasJournalToday = false;
            if (!snapshot.empty) {
               const lastDoc = snapshot.docs[0].data();
               if (lastDoc.createdAt) {
                  const lastDate = lastDoc.createdAt.toDate();
                  const today = new Date();
                  // Cek apakah tanggal, bulan, dan tahunnya sama persis dengan hari ini
                  if (lastDate.toDateString() === today.toDateString()) {
                     hasJournalToday = true;
                  }
               }
            }

            // 2. JIKA BELUM ISI: Munculkan Notifikasi & Panggil AI
            if (!hasJournalToday) {
               setShowNotif(true);
               try {
                  const res = await fetch('https://bri9-monitoring.vercel.app/api/ai-notif', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userName })
                });
                  const data = await res.json();
                  setAiMessage(data.message);
               } catch(e) {
                  setAiMessage("Database kosong, ayo isi jurnal keseharianmu sekarang! 🤖");
               }
            }
         }
      });
      return () => unsub();
   }, []);

   if (!showNotif || !isVisible) return null;

   return (
      <div className="fixed top-6 left-4 right-4 z-[500] animate-in slide-in-from-top-10 fade-in duration-500">
         <div className="bg-[#1c1c1e]/95 backdrop-blur-xl border border-blue-500/30 p-4 rounded-2xl shadow-[0_10px_30px_rgba(37,99,235,0.2)] flex items-center justify-between gap-3 relative">
            
            {/* Tombol Close (X) */}
            <button onClick={() => setIsVisible(false)} className="absolute -top-2 -right-2 w-6 h-6 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 hover:text-white border border-gray-600">
               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>

            <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                  <span className="text-xl animate-bounce">🤖</span>
               </div>
               <div>
                  <h4 className="text-[11px] font-extrabold text-blue-400 uppercase tracking-widest mb-1">Incoming Transmission</h4>
                  <p className="text-sm text-gray-200 leading-snug font-medium pr-2">{aiMessage}</p>
               </div>
            </div>
            
            <Link href="/journal">
               <button className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap shadow-lg shadow-blue-500/30 shrink-0">
                  Tulis Jurnal
               </button>
            </Link>
         </div>
      </div>
   );
}