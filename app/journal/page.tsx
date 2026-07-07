"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import Navbar from '@/components/Navbar';

export default function JournalAI() {
  const [userUid, setUserUid] = useState<string | null>(null);
  const [userName, setUserName] = useState('Ubaidullah');
  const [activities, setActivities] = useState<any[]>([]);
  const [newActivity, setNewActivity] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hud, setHud] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  
  const [aiInsight, setAiInsight] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  
  // Mencegah AI terus-terusan merespons teks yang sama
  const [lastAnalyzedId, setLastAnalyzedId] = useState<string | null>(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
         setUserUid(user.uid);
         setUserName(localStorage.getItem('bri9_username') || user.email?.split('@')[0] || 'Ubaidullah');
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!userUid) return;
    const qLogs = query(collection(db, "life_journal"), where("userId", "==", userUid), orderBy("createdAt", "desc"));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const logsList: any[] = [];
      snapshot.forEach(doc => logsList.push({ id: doc.id, ...doc.data() }));
      setActivities(logsList);
    });
    return () => unsubLogs();
  }, [userUid]);

  // EFEK BARU: MENGHUBUNGI SERVER GOOGLE GEMINI
  useEffect(() => {
     if (activities.length > 0) {
        const latestAct = activities[0];
        // Hanya panggil AI jika ID catatan ini belum pernah dianalisis
        if (latestAct.id !== lastAnalyzedId) {
           setLastAnalyzedId(latestAct.id);
           fetchAiInsight(latestAct.text);
        }
     } else {
        setAiInsight(`Halo ${userName}! Belum ada catatan aktivitas hari ini. Ceritakan apa proyekmu hari ini, kendala codingmu, atau minta rekomendasi lagu!`);
     }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities]); 

  const fetchAiInsight = async (text: string) => {
      setIsAiThinking(true);
      try {
         // MENGHUBUNGI SERVER VERCEL ANDA
         const res = await fetch('https://bri9-monitoring.vercel.app/api/Gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, userName: userName })
         });
         const data = await res.json();
         
         if (data.insight) {
            // Hapus tanda bintang (*) markdown bawaan Gemini agar teks terlihat lebih rapi
            const cleanText = data.insight.replace(/\*/g, '');
            setAiInsight(cleanText);
         } else {
            setAiInsight("Maaf, otak AI sedang *maintenance* sejenak 💤");
         }
      } catch (e) {
         setAiInsight("Koneksi ke otak pusat AI terputus 🔌 Pastikan internet menyala.");
      } finally {
         setIsAiThinking(false);
      }
  };

  const showHud = (message: string, type: 'success' | 'error') => {
    setHud({ message, type });
    setTimeout(() => setHud(null), 2500);
  };

  const handleSaveActivity = async () => {
     if (!newActivity.trim()) return showHud("Tuliskan aktivitas atau kendalamu dulu!", "error");
     setIsSaving(true);
     try {
        await addDoc(collection(db, "life_journal"), {
           userId: auth.currentUser?.uid,
           text: newActivity,
           createdAt: serverTimestamp()
        });
        showHud("Jurnal berhasil disimpan!", "success");
        setNewActivity('');
     } catch (e) {
        showHud("Gagal menyimpan aktivitas", "error");
     } finally {
        setIsSaving(false);
     }
  };

  const handleDelete = async (id: string) => {
     if (window.confirm("Apakah Anda yakin ingin menghapus catatan ini?")) {
        try {
           await deleteDoc(doc(db, "life_journal", id));
           showHud("Jurnal dihapus", "success");
        } catch (e) {
           showHud("Gagal menghapus", "error");
        }
     }
  };

  return (
    <div className="min-h-screen bg-black select-none flex justify-center">
      <main className="w-full max-w-md min-h-screen bg-black text-white font-sans pb-32">
        
        {hud && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center pointer-events-none bg-black/40 backdrop-blur-[2px] transition-all duration-300">
             <div className="bg-[#1c1c1e]/80 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center justify-center gap-4 animate-in zoom-in-90 fade-in duration-300 min-w-[160px] max-w-[200px]">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${hud.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                   {hud.type === 'success' ? <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg> : <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>}
                </div>
                <p className="text-white font-semibold text-sm text-center tracking-wide">{hud.message}</p>
             </div>
          </div>
        )}

        <header className="px-6 pt-10 pb-4 bg-black sticky top-0 z-40 flex items-center mb-2">
          <Link href="/"><button className="w-10 h-10 bg-[#1c1c1e] rounded-full flex items-center justify-center border border-gray-800 mr-4 hover:bg-gray-800 transition"><svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button></Link>
          <h1 className="text-[17px] font-semibold tracking-wide">Daily & AI Coach</h1>
        </header>

        {/* AI COACH BOX (GLOWING) */}
        <section className="px-6 mb-6">
           <div className="relative p-[2px] rounded-[1.5rem] bg-gradient-to-r from-blue-500 via-purple-500 to-fuchsia-500 animate-gradient-xy shadow-[0_0_25px_rgba(168,85,247,0.2)]">
              <div className="bg-[#151515] p-5 rounded-[1.4rem] h-full w-full">
                 <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl animate-bounce">🧠</span>
                    <h3 className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-fuchsia-400 tracking-wide text-sm uppercase">Bri9 Generative AI</h3>
                 </div>
                 
                 {isAiThinking ? (
                    <div className="flex items-center gap-3 py-2">
                       <div className="flex gap-1"><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce delay-75"></div><div className="w-2 h-2 bg-fuchsia-500 rounded-full animate-bounce delay-150"></div></div>
                       <p className="text-xs text-gray-400 italic">AI sedang menyusun jawaban...</p>
                    </div>
                 ) : (
                    <p className="text-[13px] leading-relaxed text-gray-300 font-medium whitespace-pre-wrap">
                       {aiInsight}
                    </p>
                 )}
              </div>
           </div>
        </section>

        <section className="px-6 mb-8">
           <div className="bg-[#1c1c1e] rounded-[1.5rem] p-5 border border-white/5 shadow-xl">
              <label className="text-xs text-gray-400 mb-2 block font-bold uppercase tracking-wider">Apa kabarmu hari ini?</label>
              <textarea 
                 value={newActivity} 
                 onChange={(e) => setNewActivity(e.target.value)} 
                 rows={4}
                 placeholder="Coba ketik: 'Beri aku lagu Coldplay untuk ngoding' atau 'Bang, error Firebase tidak hilang-hilang!'" 
                 className="w-full bg-[#262629] text-white p-4 rounded-2xl outline-none border border-transparent focus:border-blue-500/50 text-[14px] leading-relaxed transition-colors resize-none mb-3"
              />
              <button 
                 onClick={handleSaveActivity} 
                 disabled={isSaving} 
                 className={`w-full py-3.5 rounded-xl font-bold text-[14px] flex items-center justify-center transition-all ${isSaving ? 'bg-blue-600/50 text-white/50 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.3)]'}`}
              >
                 {isSaving ? "Menyimpan..." : "Kirim ke AI"}
              </button>
           </div>
        </section>

        <section className="px-6">
           <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-5 pl-1">Riwayat Jurnal</h3>
           
           {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-500 text-sm text-center">
                 <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                 Belum ada jurnal yang ditulis.
              </div>
           ) : (
              <div className="flex flex-col gap-4 relative">
                 <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-gray-800/50 z-0"></div>

                 {activities.map((act) => {
                    const dateObj = act.createdAt ? act.createdAt.toDate() : new Date();
                    const timeString = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    const dateString = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });

                    return (
                       <div key={act.id} className="relative z-10 flex gap-4 items-start group">
                          <div className="w-10 h-10 rounded-full bg-[#1c1c1e] border-4 border-black flex items-center justify-center shrink-0 mt-0.5 group-hover:border-blue-500 transition-colors">
                             <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          </div>
                          
                          <div className="flex-1 bg-[#151515] p-4 rounded-[1.2rem] border border-white/5 shadow-md flex justify-between items-start gap-3 transition-colors hover:bg-[#1a1a1c]">
                             <div className="flex-1 min-w-0">
                                <p className="text-[13px] text-gray-300 leading-relaxed mb-2 whitespace-pre-wrap">{act.text}</p>
                                <p className="text-[10px] text-gray-500 font-medium">{dateString}, {timeString}</p>
                             </div>
                             
                             <button 
                                onClick={() => handleDelete(act.id)} 
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors shrink-0"
                                title="Hapus Jurnal"
                             >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                             </button>
                          </div>
                       </div>
                    );
                 })}
              </div>
           )}
        </section>

        <Navbar activeMenu="home" />
      </main>
      
      <style jsx global>{`
        @keyframes gradient-xy {
          0%, 100% { background-size: 400% 400%; background-position: 0% 0%; }
          50% { background-size: 200% 200%; background-position: 100% 100%; }
        }
        .animate-gradient-xy { animation: gradient-xy 3s ease infinite; }
      `}</style>
    </div>
  );
}