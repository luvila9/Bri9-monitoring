"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
// MENGIMPOR ONSNAPSHOT & ORDERBY
import { collection, addDoc, serverTimestamp, query, where, getDocs, onSnapshot, orderBy } from 'firebase/firestore';

type OilViscosity = '10W-30' | '10W-40' | '20W-50' | 'Full Synthetic';

const oilData: Record<OilViscosity, { limit: number; desc: string }> = {
  '10W-30': { limit: 3000, desc: 'Optimal for modern daily engines (esp. Honda). Change every 3,000 KM.' },
  '10W-40': { limit: 3000, desc: 'Standard semi-synthetic for daily use. Change every 3,000 KM.' },
  '20W-50': { limit: 2000, desc: 'Thicker mineral oil for older engines. Change every 2,000 KM.' },
  'Full Synthetic': { limit: 4000, desc: 'Maximum protection for sport/touring. Change every 4,000 KM.' }
};

export default function UpdateVehicle() {
  const router = useRouter();
  
  const [type, setType] = useState<'fuel' | 'oil'>('fuel');
  const [isLoading, setIsLoading] = useState(false);
  const [hud, setHud] = useState<{ message: string, type: 'success' | 'error' | 'loading' } | null>(null);

  const [plateNumber, setPlateNumber] = useState('');
  const [odometer, setOdometer] = useState(''); 

  const [liters, setLiters] = useState('');
  const [fuelPrice, setFuelPrice] = useState('');
  const [fuelType, setFuelType] = useState('Pertamax');
  const fuelOptions = ['Pertalite', 'Pertamax', 'Pertamax Turbo'];

  const [oilViscosity, setOilViscosity] = useState<OilViscosity>('10W-40');
  const [oilPrice, setOilPrice] = useState(''); 
  const oilOptions: OilViscosity[] = ['10W-30', '10W-40', '20W-50', 'Full Synthetic'];

  // === STATE BARU: METODE PEMBAYARAN ===
  const [paymentMethod, setPaymentMethod] = useState<'Transfer' | 'Cash'>('Transfer');

  const [vehicleInfo, setVehicleInfo] = useState<any>(null);
  
  // STATE RIWAYAT PERJALANAN
  const [tripHistory, setTripHistory] = useState<any[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('plate');
    if (p) {
       setPlateNumber(p);
       fetchVehicleInfo(p);
    }
  }, []);

  // EFFECT UNTUK MENARIK DATA RIWAYAT PERJALANAN
  useEffect(() => {
    if (!plateNumber) return;
    
    const qLogs = query(
      collection(db, "vehicle_logs"),
      where("plateNumber", "==", plateNumber),
      where("type", "==", "trip"),
      orderBy("date", "desc")
    );
    
    const unsub = onSnapshot(qLogs, (snap) => {
       const logs: any[] = [];
       snap.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
       setTripHistory(logs);
    });
    
    return () => unsub();
  }, [plateNumber]);

  const fetchVehicleInfo = async (plate: string) => {
    try {
      const q = query(collection(db, "vehicles"), where("plate", "==", plate));
      const snap = await getDocs(q);
      if (!snap.empty) setVehicleInfo(snap.docs[0].data());
    } catch (error) {
      console.log("Gagal memuat detail kendaraan.");
    }
  };

  const showHud = (message: string, type: 'success' | 'error' | 'loading' = 'error') => {
    setHud({ message, type });
    if (type !== 'loading') setTimeout(() => setHud(null), 2500); 
  };

  const formatThousand = (val: string) => val.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const handleOdometer = (e: any) => setOdometer(formatThousand(e.target.value));
  const handleFuelPrice = (e: any) => setFuelPrice(formatThousand(e.target.value));
  const handleOilPrice = (e: any) => setOilPrice(formatThousand(e.target.value));
  
  const handleLiters = (e: any) => {
    let val = e.target.value.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
    setLiters(val);
  };

  const handleSubmit = async () => {
    const parseNum = (val: string) => Number(val.replace(/\./g, ''));
    const parsedOdo = parseNum(odometer);
    const parsedFuelPrice = parseNum(fuelPrice);
    const parsedOilPrice = parseNum(oilPrice);

    if (!plateNumber.trim()) return showHud("Plat nomor tidak ditemukan. Kembali ke Dashboard.", "error");
    if (!parsedOdo || parsedOdo <= 0) return showHud("Masukkan angka Odometer yang valid.", "error");

    if (type === 'fuel') {
      if (!liters || Number(liters) <= 0) return showHud("Masukkan jumlah liter yang diisi.", "error");
      if (!parsedFuelPrice || parsedFuelPrice <= 0) return showHud("Masukkan total harga BBM.", "error");
    }
    
    if (type === 'oil') {
      if (!parsedOilPrice || parsedOilPrice <= 0) return showHud("Masukkan biaya ganti oli.", "error");
    }

    setIsLoading(true);

    try {
      await addDoc(collection(db, "vehicle_logs"), {
        type: type,
        plateNumber: plateNumber.trim().toUpperCase(),
        odometer: parsedOdo, 
        liters: type === 'fuel' ? Number(liters) : null,
        fuelType: type === 'fuel' ? fuelType : null,
        price: type === 'fuel' ? parsedFuelPrice : parsedOilPrice, 
        oilViscosity: type === 'oil' ? oilViscosity : null,
        oilLimit: type === 'oil' ? oilData[oilViscosity].limit : null,
        date: new Date().toISOString(),
        createdAt: serverTimestamp(),
        userId: auth.currentUser?.uid 
      });

      if (type === 'fuel') {
        await addDoc(collection(db, "transactions"), {
          type: 'expense',
          amount: parsedFuelPrice, 
          category: 'Fuel', 
          note: `${fuelType} - ${liters}L (${plateNumber.trim().toUpperCase()})`,
          receiptUrl: null, 
          date: new Date().toISOString(),
          createdAt: serverTimestamp(),
          userId: auth.currentUser?.uid,
          paymentMethod: paymentMethod // <-- Menyimpan Pilihan Metode
        });
      } else if (type === 'oil') {
        await addDoc(collection(db, "transactions"), {
          type: 'expense',
          amount: parsedOilPrice, 
          category: 'Vehicle Maintenance', 
          note: `Ganti Oli ${oilViscosity} (${plateNumber.trim().toUpperCase()})`,
          receiptUrl: null, 
          date: new Date().toISOString(),
          createdAt: serverTimestamp(),
          userId: auth.currentUser?.uid,
          paymentMethod: paymentMethod // <-- Menyimpan Pilihan Metode
        });
      }

      showHud("Vehicle data updated!", "success");
      setTimeout(() => router.push('/'), 1500);
      
    } catch (error) {
      console.error("Error saving vehicle data:", error);
      showHud("Gagal menyimpan data. Periksa koneksi.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const specs = vehicleInfo?.engineSpecs;

  return (
    <main className="min-h-screen bg-black text-white font-sans p-6 pb-24 relative overflow-x-hidden">
      
      {hud && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none bg-black/40 backdrop-blur-[2px] transition-all duration-300">
           <div className="bg-[#1c1c1e]/80 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center justify-center gap-4 animate-in zoom-in-90 fade-in duration-300 min-w-[160px] max-w-[200px]">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${hud.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                 {hud.type === 'success' ? (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                 ) : (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                 )}
              </div>
              <p className="text-white font-semibold text-sm text-center tracking-wide">{hud.message}</p>
           </div>
        </div>
      )}

      <header className="flex items-center mb-8 pt-2">
        <Link href="/">
          <button className="w-11 h-11 bg-[#1c1c1e] rounded-full flex items-center justify-center border border-gray-800 mr-4 hover:bg-gray-800 transition">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
        </Link>
        <h1 className="text-xl font-medium tracking-wide">Update Vehicle</h1>
      </header>

      {/* --- BANNER PERINGATAN CC MESIN (STANDAR & BORE UP) --- */}
      {specs?.calculatedCC && (
         specs.isBoreUp ? (
            <div className="flex flex-col gap-4 mb-6">
              {/* BANNER BORE UP (MERAH) */}
              <div className="bg-[#1a0f14] border border-red-500/30 rounded-3xl p-5 relative overflow-hidden animate-in fade-in slide-in-from-top-4">
                 <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none"></div>
                 <div className="flex items-start gap-3 relative z-10">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 shrink-0">
                       <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    </div>
                    <div>
                       <h3 className="text-sm font-bold text-red-400">Peringatan Mesin Modifikasi</h3>
                       <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                          Motor ini tercatat berkapasitas <span className="text-white font-bold">{specs.calculatedCC.toFixed(0)}cc</span>. Pastikan menggunakan BBM beroktan tinggi dan pertahankan debit injektor di angka <span className="text-white font-bold">{specs.injectorFlow?.toFixed(0)} cc/min</span> agar tidak lean.
                       </p>
                    </div>
                 </div>
              </div>

              {/* KOTAK DESKRIPSI JURNAL MODIFIKASI */}
              <div className="bg-[#1c1c1e] border border-white/5 shadow-lg rounded-3xl p-5 animate-in fade-in slide-in-from-top-6">
                 <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest border-b border-white/10 pb-3 mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                    Jurnal Spesifikasi Mesin
                 </h3>
                 
                 <div className="grid grid-cols-2 gap-y-4 gap-x-3">
                    <div>
                      <p className="text-[10px] text-gray-500 font-medium">Piston / Bore</p>
                      <p className="text-sm font-bold text-white">{specs.piston ? `${specs.piston} mm` : '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-medium">Total Stroke</p>
                      <p className="text-sm font-bold text-white">{specs.totalStroke ? `${specs.totalStroke} mm` : '-'}</p>
                      {specs.strokeUp > 0 && <p className="text-[9px] text-red-400 mt-0.5">+{specs.strokeUp} mm dari ori</p>}
                    </div>
                    
                    {/* Render data opsional hanya jika diisi */}
                    {(specs.klepIn || specs.klepEx) && (
                       <div>
                         <p className="text-[10px] text-gray-500 font-medium">Klep (IN/EX)</p>
                         <p className="text-sm font-bold text-white">{specs.klepIn || '-'} / {specs.klepEx || '-'} mm</p>
                       </div>
                    )}
                    {specs.throttleBody && (
                       <div>
                         <p className="text-[10px] text-gray-500 font-medium">TB / Karburator</p>
                         <p className="text-sm font-bold text-white">{specs.throttleBody} mm</p>
                       </div>
                    )}
                    {specs.compressionRatio && (
                       <div>
                         <p className="text-[10px] text-gray-500 font-medium">Rasio Kompresi</p>
                         <p className="text-sm font-bold text-white">{specs.compressionRatio} : 1</p>
                       </div>
                    )}
                    {specs.camshaft && (
                       <div className="col-span-2">
                         <p className="text-[10px] text-gray-500 font-medium">Noken As / Camshaft</p>
                         <p className="text-sm font-bold text-white">{specs.camshaft}</p>
                       </div>
                    )}
                 </div>
              </div>
            </div>
         ) : (
            // BANNER STANDAR MOGE/NORMAL (BIRU)
            <div className="bg-[#0f172a] border border-blue-500/30 rounded-3xl p-5 mb-6 relative overflow-hidden animate-in fade-in slide-in-from-top-4">
               <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none"></div>
               <div className="flex items-start gap-3 relative z-10">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">
                     <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                     <h3 className="text-sm font-bold text-blue-400">Info Spesifikasi Mesin</h3>
                     <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                        Kendaraan standar pabrik ini memiliki kapasitas tercatat sebesar <span className="text-white font-bold">{specs.calculatedCC.toFixed(0)}cc</span>. Gunakan selalu jenis BBM yang direkomendasikan pada buku panduan.
                     </p>
                  </div>
               </div>
            </div>
         )
      )}

      <div className="flex bg-[#1c1c1e] rounded-full p-1 mb-6 border border-white/5">
        <button onClick={() => setType('fuel')} className={`flex-1 py-3 rounded-full text-sm font-bold transition-all ${type === 'fuel' ? 'bg-gradient-to-r from-[#4a1c40] to-[#fd1d1d] text-white shadow-md scale-[1.02]' : 'text-gray-400 hover:text-white'}`}>
          ⛽ Fuel Refill
        </button>
        <button onClick={() => setType('oil')} className={`flex-1 py-3 rounded-full text-sm font-bold transition-all ${type === 'oil' ? 'bg-gradient-to-r from-[#1a4069] to-[#3a7bd5] text-white shadow-md scale-[1.02]' : 'text-gray-400 hover:text-white'}`}>
          🛢️ Oil Change
        </button>
      </div>

      <div className="flex flex-col gap-5">

        <div className="bg-[#1c1c1e] rounded-[2rem] p-6 border border-white/5 flex flex-col gap-4 relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          
          <div className="flex justify-between items-center relative z-10">
            <label className="text-xs text-gray-400 font-medium">Current Odometer (Total KM)</label>
            <button type="button" onClick={() => showHud("AI Scanner feature is under development!", "error")} className="bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 border border-blue-500/20 hover:bg-blue-500/20 transition-all shadow-lg">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Scan AI
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 relative z-10">
            <input type="text" inputMode="numeric" value={odometer} onChange={handleOdometer} placeholder="0" className="bg-transparent text-[3rem] font-bold text-white w-full text-center outline-none placeholder-gray-800 tracking-tight appearance-none"/>
            <span className="text-xl font-semibold text-gray-600 mt-3">KM</span>
          </div>
          <p className="text-[10px] text-gray-500 text-center relative z-10">Ketik manual angka spidometer motor Anda saat ini.</p>
        </div>

        {/* --- FUEL SECTION --- */}
        {type === 'fuel' && (
          <div className="bg-[#1c1c1e] rounded-[2rem] p-5 border border-white/5 flex flex-col gap-5 shadow-lg">
            <div>
              <label className="text-xs text-gray-500 ml-1 mb-2 block">Jenis Bahan Bakar</label>
              <div className="flex bg-[#262629] p-1.5 rounded-2xl">
                {fuelOptions.map((f) => (
                  <button key={f} onClick={() => setFuelType(f)} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${fuelType === f ? 'bg-white text-black shadow' : 'text-gray-400 hover:text-white'}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
               <div className="flex-1">
                 <label className="text-xs text-gray-500 ml-1 mb-2 block">Liter Terisi</label>
                 <div className="flex items-center bg-[#262629] p-4 rounded-2xl border border-transparent focus-within:border-gray-500 transition-colors">
                   <input type="text" inputMode="decimal" value={liters} onChange={handleLiters} placeholder="3.5" className="w-full bg-transparent text-white outline-none text-sm placeholder-gray-500"/>
                   <span className="text-gray-400 text-sm font-medium">L</span>
                 </div>
               </div>

               <div className="flex-[1.5]">
                 <label className="text-xs text-gray-500 ml-1 mb-2 block">Harga Total</label>
                 <div className="flex items-center bg-[#262629] p-4 rounded-2xl border border-transparent focus-within:border-gray-500 transition-colors">
                   <span className="text-gray-400 text-sm font-medium mr-2">Rp</span>
                   <input type="text" inputMode="numeric" value={fuelPrice} onChange={handleFuelPrice} placeholder="35.000" className="w-full bg-transparent text-white outline-none text-sm placeholder-gray-500"/>
                 </div>
               </div>
            </div>
          </div>
        )}

        {/* --- OIL SECTION --- */}
        {type === 'oil' && (
          <div className="bg-[#1c1c1e] rounded-[2rem] p-5 border border-white/5 flex flex-col gap-5 shadow-lg">
             <div>
               <label className="text-xs text-gray-500 ml-1 mb-3 block">Kekentalan Oli (Viscosity)</label>
               <div className="grid grid-cols-2 gap-3">
                  {oilOptions.map((o) => (
                    <button key={o} onClick={() => setOilViscosity(o)} className={`py-3.5 rounded-2xl text-xs font-semibold border transition-all ${oilViscosity === o ? 'bg-[#3a7bd5]/20 border-[#3a7bd5] text-[#3a7bd5]' : 'bg-[#262629] border-transparent text-gray-400 hover:bg-[#333336]'}`}>
                      {o}
                    </button>
                  ))}
               </div>
             </div>

             <div className="bg-[#1a2332] p-4 rounded-2xl border border-[#3a7bd5]/30 flex flex-col gap-1">
                <p className="text-[10px] text-blue-300/80 uppercase tracking-wider font-bold">Target Optimal Pergantian</p>
                <p className="text-lg font-bold text-white">{oilData[oilViscosity].limit} KM</p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{oilData[oilViscosity].desc}</p>
             </div>

             <div>
               <label className="text-xs text-gray-500 ml-1 mb-2 block">Total Biaya Bengkel</label>
               <div className="flex items-center bg-[#262629] p-4 rounded-2xl border border-transparent focus-within:border-gray-500 transition-colors">
                 <span className="text-gray-400 text-sm font-medium mr-2">Rp</span>
                 <input type="text" inputMode="numeric" value={oilPrice} onChange={handleOilPrice} placeholder="65.000" className="w-full bg-transparent text-white outline-none text-sm placeholder-gray-500"/>
               </div>
             </div>
          </div>
        )}

        {/* === KOTAK PEMILIHAN METODE PEMBAYARAN === */}
        <div className="bg-[#1c1c1e] rounded-[2rem] p-5 border border-white/5 flex flex-col gap-3 shadow-lg">
           <label className="text-xs text-gray-500 ml-1 block font-medium">Metode Pembayaran</label>
           <div className="flex bg-[#262629] p-1.5 rounded-2xl">
             <button onClick={() => setPaymentMethod('Cash')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${paymentMethod === 'Cash' ? 'bg-emerald-500 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                💵 Cash
             </button>
             <button onClick={() => setPaymentMethod('Transfer')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${paymentMethod === 'Transfer' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                💳 Saldo
             </button>
           </div>
           <p className="text-[10px] text-gray-500 text-center mt-1">Pengeluaran ini akan langsung memotong {paymentMethod === 'Transfer' ? 'Saldo Rekening' : 'Uang Tunai (Cash)'} Anda.</p>
        </div>

        <button onClick={handleSubmit} disabled={isLoading} type="button" className={`w-full bg-white text-black font-bold text-[15px] py-4 rounded-full mt-2 transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center justify-center ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-gray-200 hover:scale-[1.02]'}`}>
          {isLoading ? <svg className="animate-spin h-5 w-5 mr-3 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : "Save Vehicle Data"}
        </button>

        {/* UI RIWAYAT PERJALANAN */}
        <section className="mt-8 animate-in fade-in slide-in-from-bottom-4">
           <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 pl-1">Riwayat Perjalanan (Trip Logs)</h3>
           
           <div className="flex flex-col gap-3">
              {tripHistory.length === 0 ? (
                 <div className="bg-[#1c1c1e] p-6 rounded-[2rem] border border-white/5 text-center">
                    <p className="text-sm text-gray-600 font-medium italic">Belum ada riwayat perjalanan terekam.</p>
                 </div>
              ) : (
                 tripHistory.map((trip) => {
                    const dateObj = new Date(trip.date);
                    const jam = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    const tanggal = dateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
                    
                    const noteTitle = trip.note ? trip.note.replace('Rute: ', '') : 'Perjalanan Tanpa Nama';

                    return (
                       <div key={trip.id} className="bg-[#1c1c1e] p-4 rounded-2xl border border-white/5 flex flex-col gap-3 shadow-lg hover:bg-[#2a2a2d] transition-colors">
                          <div className="flex justify-between items-start">
                             <h4 className="font-bold text-gray-200 text-sm pr-2">{noteTitle}</h4>
                             <span className="text-xs font-bold bg-blue-500/10 text-blue-400 px-2.5 py-1.5 rounded-lg shrink-0 border border-blue-500/20">
                                {trip.distanceAdded} KM
                             </span>
                          </div>
                          
                          <div className="flex justify-between items-center mt-1 border-t border-white/5 pt-3">
                             <div className="flex items-center gap-1.5 text-gray-500 text-[11px] font-medium tracking-wide">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {jam} • {tanggal}
                             </div>
                             <div className="text-[11px] font-bold text-gray-500">
                                Avg: <span className="text-white ml-0.5">{trip.avgSpeedKmh || "0.0"}</span> km/h
                             </div>
                          </div>
                       </div>
                    );
                 })
              )}
           </div>
        </section>

      </div>
    </main>
  );
}