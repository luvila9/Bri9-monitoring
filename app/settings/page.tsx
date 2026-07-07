"use client";
import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, onSnapshot, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

// IMPORT MESIN BAHASA KITA
import { useLanguage } from '@/context/LanguageContext';

export default function Settings() {
  const router = useRouter();
  
  // Panggil fungsi bahasa (t) dan status bahasa (lang, toggleLanguage)
  const { t, lang, toggleLanguage } = useLanguage();
  
  const [userUid, setUserUid] = useState<string | null>(null);
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  const [profilePic, setProfilePic] = useState<string | null>(null); 
  const [notif, setNotif] = useState(true);
  const [hud, setHud] = useState<{ message: string, type: 'success' | 'error' | 'loading' } | null>(null);

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isManageVehiclesOpen, setIsManageVehiclesOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; vehicleId: string; plateName: string } | null>(null);

  useEffect(() => {
    const savedNotif = localStorage.getItem('bri9_notif');
    if (savedNotif !== null) setNotif(savedNotif === 'true');

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserUid(user.uid);
        setUserEmail(user.email || '');
        
        const unsubUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
           if (docSnap.exists()) {
              const data = docSnap.data();
              if (data.name) {
                 setUserName(data.name);
                 localStorage.setItem('bri9_username', data.name);
              }
              if (data.profilePic) {
                 setProfilePic(data.profilePic);
                 localStorage.setItem('bri9_profile_pic', data.profilePic);
              }
           }
        });
        return () => unsubUser();
      } else {
        router.push('/login');
      }
    });
    return () => unsubAuth();
  }, [router]);

  useEffect(() => {
    if (!userUid) return;
    const qVehicles = query(collection(db, "vehicles"), where("userId", "==", userUid));
    const unsub = onSnapshot(qVehicles, (snapshot) => {
      const vList: any[] = [];
      snapshot.forEach(doc => vList.push({ id: doc.id, ...doc.data() }));
      setVehicles(vList);
    });
    return () => unsub();
  }, [userUid]);

  const showHud = (message: string, type: 'success' | 'error' | 'loading' = 'success') => {
    setHud({ message, type });
    if (type !== 'loading') {
      setTimeout(() => setHud(null), 2500);
    }
  };

  const handleEditName = async () => {
    const newName = window.prompt("Masukkan nama baru Anda:", userName);
    if (newName && newName.trim() !== "" && userUid) {
      const cleanName = newName.trim();
      setUserName(cleanName);
      localStorage.setItem('bri9_username', cleanName);
      try {
        await setDoc(doc(db, "users", userUid), { name: cleanName }, { merge: true });
        showHud("Nama berhasil diperbarui!", "success");
      } catch (error) {
        showHud("Gagal menyimpan ke server", "error");
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userUid) return;

    showHud("Memproses foto...", "loading");

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const base64String = canvas.toDataURL("image/jpeg", 0.7);

        try {
          await setDoc(doc(db, "users", userUid), { profilePic: base64String }, { merge: true });
          
          setProfilePic(base64String);
          localStorage.setItem('bri9_profile_pic', base64String);
          
          showHud("Foto profil diperbarui!", "success");
        } catch (error) {
          showHud("Gagal menyimpan foto", "error");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleExportData = async () => {
    if (!userUid) return;
    showHud("Menyiapkan dokumen Excel...", "loading");
    
    try {
      const qTx = query(collection(db, "transactions"), where("userId", "==", userUid));
      const querySnapshot = await getDocs(qTx);
      const txList: any[] = [];
      querySnapshot.forEach((doc) => txList.push(doc.data()));

      if (txList.length === 0) return showHud("Belum ada data untuk diekspor", "error");

      const excelData = txList
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) 
        .map((row, index) => ({
          "No": index + 1,
          "Tanggal": new Date(row.date).toLocaleDateString('id-ID'),
          "Tipe Transaksi": row.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
          "Kategori": row.category,
          "Metode Bayar": row.paymentMethod || "Tunai/Lainnya",
          "Catatan": row.note || row.investmentPlatform || row.salarySource || row.allowanceType || row.bonusSource || row.savingsGoal || "-",
          "Nominal (Rp)": row.amount 
        }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      worksheet['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 35 }, { wch: 15 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Keuangan");
      
      const fileName = `Laporan_Keuangan_Bri9_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      showHud("Laporan Excel berhasil diunduh!", "success");
    } catch (error) {
      showHud("Gagal mengunduh laporan", "error");
    }
  };

  const executeDeleteVehicle = async () => {
    if (!confirmDialog) return;
    setConfirmDialog(null);
    showHud("Menghapus kendaraan...", "loading");
    try {
      await deleteDoc(doc(db, "vehicles", confirmDialog.vehicleId));
      showHud("Kendaraan berhasil dihapus!", "success");
    } catch (error) {
      showHud("Gagal menghapus kendaraan", "error");
    }
  };

  const handleLogout = async () => {
    showHud("Signing Out...", "loading");
    setTimeout(async () => {
      await signOut(auth);
      router.push('/login');
    }, 1500); 
  };

  return (
    <main className="min-h-screen bg-black text-white font-sans pb-32 relative flex justify-center">
      <div className="w-full max-w-md relative">
        
        {hud && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center pointer-events-none bg-black/40 backdrop-blur-[2px] transition-all duration-300">
             <div className="bg-[#1c1c1e]/80 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center justify-center gap-4 animate-in zoom-in-90 fade-in duration-300 min-w-[160px] max-w-[200px]">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${hud.type === 'success' ? 'bg-green-500/20 text-green-400' : hud.type === 'loading' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                   {hud.type === 'success' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                   {hud.type === 'error' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>}
                   {hud.type === 'loading' && <svg className="animate-spin w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                </div>
                <p className="text-white font-semibold text-sm text-center tracking-wide">{hud.message}</p>
             </div>
          </div>
        )}

        {confirmDialog && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6 animate-in fade-in duration-200">
            <div className="bg-[#1c1c1e] border border-gray-700/50 p-6 rounded-[2rem] shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200">
               <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-4 mx-auto">
                 <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
               </div>
               <h3 className="text-lg font-bold text-center text-white mb-2">{t('delete_vehicle')}</h3>
               <p className="text-sm text-gray-400 text-center mb-6 leading-relaxed">
                 Anda akan menghapus <span className="text-white font-semibold">{confirmDialog.plateName}</span>. Riwayat servis dan isi bensin sebelumnya akan tetap aman di database.
               </p>
               <div className="flex gap-3">
                 <button onClick={() => setConfirmDialog(null)} className="flex-1 py-3.5 rounded-xl bg-[#262629] text-white font-medium text-sm hover:bg-[#333336] transition-colors">{t('cancel')}</button>
                 <button onClick={executeDeleteVehicle} className="flex-1 py-3.5 rounded-xl bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20">{t('yes_delete')}</button>
               </div>
            </div>
          </div>
        )}

        {isManageVehiclesOpen && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col p-6 animate-in slide-in-from-bottom-full duration-300">
            <header className="flex justify-between items-center mt-8 mb-8 max-w-md mx-auto w-full">
              <h2 className="text-2xl font-bold text-white tracking-tight">{t('manage_vehicle')}</h2>
              <button onClick={() => setIsManageVehiclesOpen(false)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </header>
            
            <div className="flex flex-col gap-4 overflow-y-auto max-w-md mx-auto w-full hide-scrollbar pb-20">
              {vehicles.length === 0 ? (
                <div className="text-center py-10"><p className="text-gray-500 text-sm">{t('no_vehicle')}</p></div>
              ) : (
                vehicles.map((v) => (
                  <div key={v.id} className="bg-[#151515] border border-white/5 rounded-3xl p-5 flex justify-between items-center shadow-lg">
                    <div>
                      <p className="text-white font-bold text-lg tracking-wider mb-1">{v.plate}</p>
                      <p className="text-gray-400 text-sm">{v.name} • {v.type}</p>
                    </div>
                    <button onClick={() => setConfirmDialog({ isOpen: true, vehicleId: v.id, plateName: v.plate })} className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 hover:bg-red-500/20 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <header className="flex justify-between items-center px-6 pt-10 mb-8">
          <div className="w-6"></div>
          <h1 className="text-[17px] font-semibold tracking-wide">{t('settings')}</h1>
          <div className="w-6"></div>
        </header>

        <div className="flex flex-col items-center justify-center mb-10">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-[#1c1c1e] overflow-hidden border-2 border-gray-800 mb-3 shadow-lg">
              <img src={profilePic || `https://ui-avatars.com/api/?name=${userName}&background=1c1c1e&color=fff`} alt="Profile" className="w-full h-full object-cover"/>
            </div>
            <label className="absolute bottom-3 right-0 bg-blue-600 p-2 rounded-full cursor-pointer shadow-lg border border-black hover:scale-110 transition-transform">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          </div>
          
          <div className="flex items-center gap-2 group cursor-pointer" onClick={handleEditName}>
            <h2 className="text-xl font-semibold tracking-wide capitalize group-hover:text-blue-400 transition-colors">{userName}</h2>
            <svg className="w-4 h-4 text-gray-500 group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </div>
          <p className="text-xs text-gray-500 mt-1">{userEmail}</p>
        </div>

        <div className="px-6 flex flex-col gap-6">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 ml-2">{t('data_report')}</h3>
            <div className="bg-[#151515] rounded-[1.5rem] border border-white/5 flex flex-col overflow-hidden">
              <div className="flex justify-between items-center p-5 border-b border-white/5 cursor-pointer hover:bg-white/5" onClick={handleExportData}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></div>
                  <span className="text-sm font-medium text-gray-200">{t('export_excel')}</span>
                </div>
              </div>
              <div className="flex justify-between items-center p-5 border-b border-white/5 cursor-pointer hover:bg-white/5" onClick={() => setIsManageVehiclesOpen(true)}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
                  <span className="text-sm font-medium text-gray-200">{t('manage_vehicle')}</span>
                </div>
                <span className="text-gray-500 text-sm">&gt;</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 ml-2">{t('preferences')}</h3>
            <div className="bg-[#151515] rounded-[1.5rem] border border-white/5 flex flex-col overflow-hidden">
              
              {/* TOMBOL GANTI BAHASA BARU */}
              <div className="flex justify-between items-center p-5 border-b border-white/5 cursor-pointer hover:bg-white/5" onClick={toggleLanguage}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg></div>
                  <span className="text-sm font-medium text-gray-200">{t('language')}</span>
                </div>
                <span className="text-gray-400 text-xs font-bold bg-[#1c1c1e] px-3 py-1 rounded-full border border-gray-700 uppercase">{lang}</span>
              </div>

              <div className="flex justify-between items-center p-5 border-b border-white/5 cursor-pointer hover:bg-white/5" onClick={() => { setNotif(!notif); localStorage.setItem('bri9_notif', String(!notif)); }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg></div>
                  <span className="text-sm font-medium text-gray-200">{t('push_notif')}</span>
                </div>
                <button className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${notif ? 'bg-blue-500' : 'bg-gray-700'}`}><div className={`w-4 h-4 bg-white rounded-full transition-transform ${notif ? 'translate-x-6' : 'translate-x-0'}`}></div></button>
              </div>
              <div className="flex justify-between items-center p-5 cursor-pointer hover:bg-white/5" onClick={() => showHud("Link ganti password dikirim ke email!", "success")}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></div>
                  <span className="text-sm font-medium text-gray-200">{t('change_pass')}</span>
                </div>
                <span className="text-gray-500 text-sm">&gt;</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <button onClick={() => showHud("Silakan hubungi Support untuk mereset akun.", "error")} className="w-full py-4 rounded-xl bg-[#1c1c1e] text-gray-400 font-semibold text-sm border border-white/5 hover:bg-[#252528] transition-colors">
              {t('reset_data')}
            </button>
            <button onClick={handleLogout} className="w-full py-4 rounded-xl bg-red-500/10 text-red-500 font-semibold text-sm border border-red-500/20 hover:bg-red-500/20 transition-colors">
              {t('sign_out')}
            </button>
          </div>
        </div>
        <Navbar activeMenu="settings" />
      </div>
      <style jsx global>{`.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
    </main>
  );
}