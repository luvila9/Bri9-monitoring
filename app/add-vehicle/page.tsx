"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function AddVehicle() {
  const router = useRouter();
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleName, setVehicleName] = useState('');
  const [vehicleType, setVehicleType] = useState('Motor'); 
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hud, setHud] = useState<{ message: string, type: 'success' | 'error' | 'loading' } | null>(null);

  const vehicleOptions = ['Motor', 'Mobil'];

  // STATE KAPASITAS MESIN (STANDAR & BORE UP)
  const [manualCC, setManualCC] = useState(''); 
  const [isBoreUp, setIsBoreUp] = useState(false);
  
  // STATE ISTILAH BENGKEL & BLOK MESIN
  const [pistonBore, setPistonBore] = useState('');
  const [baseStroke, setBaseStroke] = useState(''); 
  const [strokeUp, setStrokeUp] = useState('');     
  const [cylinderCount, setCylinderCount] = useState('1');
  const [targetRpm, setTargetRpm] = useState('9000');
  
  // STATE KOMPONEN RACING TAMBAHAN
  const [klepIn, setKlepIn] = useState('');
  const [klepEx, setKlepEx] = useState('');
  const [throttleBody, setThrottleBody] = useState('');
  const [compressionRatio, setCompressionRatio] = useState('');
  const [camshaft, setCamshaft] = useState(''); // Noken as (teks bebas, misal: "BRT T1" atau "Lift 8.5")

  const [resultCC, setResultCC] = useState<number | null>(null);
  const [resultInjector, setResultInjector] = useState<number | null>(null);
  const [resultPistonSpeed, setResultPistonSpeed] = useState<number | null>(null);

  const showHud = (message: string, type: 'success' | 'error' | 'loading' = 'error') => {
    setHud({ message, type });
    if (type !== 'loading') setTimeout(() => setHud(null), 2500); 
  };

  const handleNumberInput = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
    let val = e.target.value.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
    setter(val);
  };

  // LOGIKA MEKANIK PRO
  useEffect(() => {
    if (!isBoreUp) {
      setResultCC(null);
      setResultInjector(null);
      setResultPistonSpeed(null);
      return;
    }

    const bore = parseFloat(pistonBore);
    const strkBase = parseFloat(baseStroke);
    const strkUp = parseFloat(strokeUp) || 0; 
    const totalStroke = strkBase + strkUp;    
    const cyl = parseInt(cylinderCount);
    const rpm = parseInt(targetRpm) || 9000;

    if (bore > 0 && totalStroke > 0 && cyl > 0) {
      const pi = Math.PI;
      const volume = (pi / 4) * Math.pow(bore, 2) * totalStroke * cyl / 1000;
      setResultCC(volume);

      const pistonSpd = (totalStroke * rpm) / 30000;
      setResultPistonSpeed(pistonSpd);

      const injectorFlow = (volume * rpm) / 10000;
      setResultInjector(injectorFlow);
    } else {
      setResultCC(null);
      setResultInjector(null);
      setResultPistonSpeed(null);
    }
  }, [pistonBore, baseStroke, strokeUp, cylinderCount, targetRpm, isBoreUp]);

  const handleSubmit = async () => {
    if (!plateNumber.trim() || !vehicleName.trim()) {
      showHud("Plat Nomor dan Nama Kendaraan wajib diisi!", "error"); 
      return;
    }
    
    // Validasi WAJIB CC MESIN
    const finalCC = isBoreUp ? resultCC : parseFloat(manualCC);

    if (!finalCC || finalCC <= 0) {
      showHud(isBoreUp ? "Lengkapi ukuran Piston & Stroke untuk hitung CC!" : "Kapasitas Mesin (CC) wajib diisi!", "error");
      return;
    }

    setIsLoading(true);
    
    try {
      const finalVehicleName = `${vehicleName.trim()} (${finalCC.toFixed(0)}cc)`;
      const totalStrokeCalculated = parseFloat(baseStroke) + (parseFloat(strokeUp) || 0);

      await addDoc(collection(db, "vehicles"), {
        plate: plateNumber.trim().toUpperCase(),
        name: finalVehicleName,
        type: vehicleType,
        engineSpecs: {
           isBoreUp: isBoreUp,
           calculatedCC: finalCC,
           // Dimensi Blok & Kruk As
           piston: isBoreUp ? parseFloat(pistonBore) : null,
           strokeOri: isBoreUp ? parseFloat(baseStroke) : null,
           strokeUp: isBoreUp ? (parseFloat(strokeUp) || 0) : null,
           totalStroke: isBoreUp ? totalStrokeCalculated : null,
           cylinders: isBoreUp ? parseInt(cylinderCount) : 1,
           maxRpm: isBoreUp ? parseInt(targetRpm) : null,
           // Hasil Analisa Mekanik
           pistonSpeed: isBoreUp ? resultPistonSpeed : null,
           injectorFlow: isBoreUp ? resultInjector : null,
           // Jurnal Komponen Racing
           klepIn: isBoreUp && klepIn ? parseFloat(klepIn) : null,
           klepEx: isBoreUp && klepEx ? parseFloat(klepEx) : null,
           throttleBody: isBoreUp && throttleBody ? parseFloat(throttleBody) : null,
           compressionRatio: isBoreUp && compressionRatio ? compressionRatio : null,
           camshaft: isBoreUp && camshaft ? camshaft : null,
        },
        createdAt: serverTimestamp(),
        userId: auth.currentUser?.uid 
      });
      
      showHud("Kendaraan Berhasil Didaftarkan!", "success"); 
      setTimeout(() => router.push('/'), 1500); 
      
    } catch (error) {
      console.error(error);
      showHud("Gagal mendaftarkan kendaraan", "error"); 
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white font-sans p-6 pb-24 relative overflow-x-hidden">
      
      {hud && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none bg-black/40 backdrop-blur-[2px] transition-all duration-300">
           <div className="bg-[#1c1c1e]/80 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center justify-center gap-4 animate-in zoom-in-90 fade-in duration-300 min-w-[160px] max-w-[200px]">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${hud.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                 {hud.type === 'success' ? <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg> : <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>}
              </div>
              <p className="text-white font-semibold text-sm text-center tracking-wide">{hud.message}</p>
           </div>
        </div>
      )}

      <header className="flex items-center mb-8 pt-2">
        <Link href="/">
          <button className="w-11 h-11 bg-[#1c1c1e] rounded-full flex items-center justify-center border border-gray-800 mr-4 hover:bg-gray-800 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
        </Link>
        <h1 className="text-xl font-medium tracking-wide">Register Vehicle</h1>
      </header>

      <div className="flex flex-col gap-5">
        
        <div className="bg-[#1c1c1e] rounded-[2rem] p-5 border border-white/5">
          <label className="text-xs text-gray-500 ml-1 mb-2 block">Jenis Kendaraan</label>
          <div className="relative">
            <button 
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full bg-[#262629] text-white p-4 rounded-2xl flex justify-between items-center text-sm border border-transparent focus:border-gray-600 transition-colors"
            >
              <span className="font-medium">{vehicleType}</span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {isDropdownOpen && (
              <div className="absolute z-50 w-full mt-2 bg-[#262629] border border-gray-700 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                {vehicleOptions.map((vType, index) => (
                  <div key={index} onClick={() => { setVehicleType(vType); setIsDropdownOpen(false); }} className="p-4 text-sm font-medium text-gray-200 hover:bg-[#333336] hover:text-white cursor-pointer transition-colors border-b border-gray-700/50 last:border-0 flex items-center gap-3">
                    {vType}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#1c1c1e] rounded-[2rem] p-5 border border-white/5">
          <label className="text-xs text-gray-500 ml-1 mb-2 block">Plat Nomor (License Plate) <span className="text-red-500">*</span></label>
          <input type="text" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value.toUpperCase())} placeholder="e.g., B 3254 BXA" className="w-full bg-[#262629] p-4 rounded-2xl text-white outline-none text-sm uppercase tracking-widest font-semibold placeholder-gray-600 focus:border-gray-500 border border-transparent transition-colors"/>
        </div>

        <div className="bg-[#1c1c1e] rounded-[2rem] p-5 border border-white/5">
          <label className="text-xs text-gray-500 ml-1 mb-2 block">Nama Kendaraan (Model) <span className="text-red-500">*</span></label>
          <input type="text" value={vehicleName} onChange={(e) => setVehicleName(e.target.value)} placeholder="e.g., Honda Vario 150 / Z1000" className="w-full bg-[#262629] p-4 rounded-2xl text-white outline-none text-sm placeholder-gray-600 focus:border-gray-500 border border-transparent transition-colors"/>
        </div>

        {/* --- KAPASITAS MESIN (STANDAR & BORE UP) --- */}
        {vehicleType === 'Motor' && (
           <div className={`bg-[#1c1c1e] rounded-[2rem] p-5 border transition-all duration-300 ${isBoreUp ? 'border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'border-blue-500/20'}`}>
              
              <div className="flex justify-between items-end mb-4">
                 <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Kapasitas Mesin <span className="text-red-500">*</span></h3>
                    <p className="text-[10px] text-blue-400 font-medium">Wajib diisi untuk keakuratan profil kendaraan.</p>
                 </div>
              </div>

              {/* TAMPILAN STANDAR JIKA TIDAK BORE UP */}
              {!isBoreUp && (
                 <div className="flex items-center bg-[#262629] p-4 rounded-2xl border border-transparent focus-within:border-blue-500/50 transition-colors animate-in fade-in">
                   <input type="text" inputMode="numeric" value={manualCC} onChange={(e) => handleNumberInput(e, setManualCC)} placeholder="e.g. 150 / 1000" className="w-full bg-transparent text-white font-bold outline-none text-base placeholder-gray-600"/>
                   <span className="text-gray-500 text-xs font-bold ml-2">CC</span>
                 </div>
              )}

              <div className="flex items-center justify-between mt-5 pt-5 border-t border-white/5 cursor-pointer" onClick={() => setIsBoreUp(!isBoreUp)}>
                 <div>
                    <h3 className={`font-bold transition-colors text-sm ${isBoreUp ? 'text-red-400' : 'text-gray-300'}`}>🛠️ Gunakan Kalkulator Bore Up?</h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">Membuka menu jurnal Mekanik Pro.</p>
                 </div>
                 <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 flex items-center ${isBoreUp ? 'bg-red-500' : 'bg-gray-700'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isBoreUp ? 'translate-x-6' : 'translate-x-0'}`}></div>
                 </div>
              </div>

              {isBoreUp && (
                 <div className="mt-6 pt-6 border-t border-red-500/20 animate-in fade-in slide-in-from-top-4 duration-500 flex flex-col gap-6">
                    
                    {/* PANEL HASIL MEKANIK PRO */}
                    <div className="bg-black/40 rounded-2xl p-4 border border-red-500/20 flex flex-col gap-3 relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
                       
                       <div className="flex items-center justify-between border-b border-white/5 pb-3 relative z-10">
                          <span className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">Kapasitas Murni <span className="text-red-500">*</span></span>
                          <span className="text-2xl font-black text-white">{resultCC ? resultCC.toFixed(1) : '0.0'} <span className="text-sm text-red-500">CC</span></span>
                       </div>

                       <div className="flex items-center justify-between border-b border-white/5 pb-3 relative z-10">
                          <div>
                            <span className="text-[11px] text-gray-400 font-bold uppercase tracking-widest block">Piston Speed</span>
                            {resultPistonSpeed && (
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${resultPistonSpeed > 21 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                {resultPistonSpeed > 21 ? '⚠️ Rentan Jebol' : '✅ Aman (Daily)'}
                              </span>
                            )}
                          </div>
                          <span className="text-xl font-black text-white">{resultPistonSpeed ? resultPistonSpeed.toFixed(1) : '0.0'} <span className="text-xs text-gray-500">m/s</span></span>
                       </div>

                       <div className="flex items-center justify-between pt-1 relative z-10">
                          <span className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">Est. Debit Injektor</span>
                          <span className="text-xl font-black text-white">{resultInjector ? resultInjector.toFixed(0) : '0'} <span className="text-xs text-gray-500">cc/min</span></span>
                       </div>
                    </div>

                    {/* SEKSI 1: DIMENSI BLOK (WAJIB) */}
                    <div className="flex flex-col gap-3">
                      <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-widest px-1">1. Dimensi Blok Mesin (Wajib)</h4>
                      <div className="flex gap-3">
                         <div className="flex-[1.2]">
                           <label className="text-[10px] text-gray-400 font-bold ml-1 mb-1.5 block uppercase">Piston Akhir (mm)</label>
                           <input type="text" inputMode="decimal" value={pistonBore} onChange={(e) => handleNumberInput(e, setPistonBore)} placeholder="e.g. 58" className="w-full bg-[#262629] p-3.5 rounded-xl text-white outline-none text-sm placeholder-gray-600 focus:border-red-500/50 border border-transparent transition-colors"/>
                         </div>
                         <div className="flex-1">
                           <label className="text-[10px] text-gray-400 font-bold ml-1 mb-1.5 block uppercase">Stroke Ori (mm)</label>
                           <input type="text" inputMode="decimal" value={baseStroke} onChange={(e) => handleNumberInput(e, setBaseStroke)} placeholder="e.g. 57.9" className="w-full bg-[#262629] p-3.5 rounded-xl text-white outline-none text-sm placeholder-gray-600 focus:border-red-500/50 border border-transparent transition-colors"/>
                         </div>
                      </div>
                      <div className="flex gap-3">
                         <div className="flex-[1.2]">
                           <label className="text-[10px] text-gray-400 font-bold ml-1 mb-1.5 block uppercase flex items-center gap-1">+ Stroke Up <span className="text-[8px] font-normal text-gray-500 lowercase">(Opsional)</span></label>
                           <input type="text" inputMode="decimal" value={strokeUp} onChange={(e) => handleNumberInput(e, setStrokeUp)} placeholder="e.g. 4" className="w-full bg-[#262629] p-3.5 rounded-xl text-white outline-none text-sm placeholder-gray-600 focus:border-red-500/50 border border-transparent transition-colors"/>
                         </div>
                         <div className="flex-1">
                           <label className="text-[10px] text-gray-400 font-bold ml-1 mb-1.5 block uppercase">Silinder</label>
                           <div className="flex bg-[#262629] p-1 rounded-xl border border-white/5">
                             {['1', '2', '4'].map((num) => (
                               <button key={num} type="button" onClick={() => setCylinderCount(num)} className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-all ${cylinderCount === num ? 'bg-red-600 text-white shadow' : 'text-gray-500'}`}>{num}</button>
                             ))}
                           </div>
                         </div>
                      </div>
                      <div>
                         <label className="text-[10px] text-gray-400 font-bold ml-1 mb-1.5 block uppercase flex items-center gap-1">Max RPM <span className="text-[8px] font-normal text-gray-500 lowercase">(Limit ECU/CDI)</span></label>
                         <input type="text" inputMode="numeric" value={targetRpm} onChange={(e) => handleNumberInput(e, setTargetRpm)} placeholder="9000" className="w-full bg-[#262629] p-3.5 rounded-xl text-white outline-none text-sm placeholder-gray-600 focus:border-red-500/50 border border-transparent transition-colors"/>
                      </div>
                    </div>

                    {/* SEKSI 2: JURNAL KOMPONEN (OPSIONAL) */}
                    <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
                      <h4 className="text-[10px] font-bold text-gray-300 uppercase tracking-widest px-1">2. Jurnal Spesifikasi (Opsional)</h4>
                      
                      <div className="flex gap-3">
                         <div className="flex-1">
                           <label className="text-[10px] text-gray-400 font-bold ml-1 mb-1.5 block uppercase">Klep IN (mm)</label>
                           <input type="text" inputMode="decimal" value={klepIn} onChange={(e) => handleNumberInput(e, setKlepIn)} placeholder="e.g. 31" className="w-full bg-[#262629] p-3.5 rounded-xl text-white outline-none text-sm placeholder-gray-600 focus:border-blue-500/50 border border-transparent transition-colors"/>
                         </div>
                         <div className="flex-1">
                           <label className="text-[10px] text-gray-400 font-bold ml-1 mb-1.5 block uppercase">Klep EX (mm)</label>
                           <input type="text" inputMode="decimal" value={klepEx} onChange={(e) => handleNumberInput(e, setKlepEx)} placeholder="e.g. 26" className="w-full bg-[#262629] p-3.5 rounded-xl text-white outline-none text-sm placeholder-gray-600 focus:border-blue-500/50 border border-transparent transition-colors"/>
                         </div>
                      </div>

                      <div className="flex gap-3">
                         <div className="flex-1">
                           <label className="text-[10px] text-gray-400 font-bold ml-1 mb-1.5 block uppercase">TB / Karbu (mm)</label>
                           <input type="text" inputMode="decimal" value={throttleBody} onChange={(e) => handleNumberInput(e, setThrottleBody)} placeholder="e.g. 32" className="w-full bg-[#262629] p-3.5 rounded-xl text-white outline-none text-sm placeholder-gray-600 focus:border-blue-500/50 border border-transparent transition-colors"/>
                         </div>
                         <div className="flex-1">
                           <label className="text-[10px] text-gray-400 font-bold ml-1 mb-1.5 block uppercase">Kompresi</label>
                           <input type="text" inputMode="decimal" value={compressionRatio} onChange={(e) => handleNumberInput(e, setCompressionRatio)} placeholder="e.g. 12.5" className="w-full bg-[#262629] p-3.5 rounded-xl text-white outline-none text-sm placeholder-gray-600 focus:border-blue-500/50 border border-transparent transition-colors"/>
                         </div>
                      </div>

                      <div>
                         <label className="text-[10px] text-gray-400 font-bold ml-1 mb-1.5 block uppercase">Noken As / Camshaft</label>
                         <input type="text" value={camshaft} onChange={(e) => setCamshaft(e.target.value)} placeholder="e.g. BRT T1 / Lift 8.5" className="w-full bg-[#262629] p-3.5 rounded-xl text-white outline-none text-sm placeholder-gray-600 focus:border-blue-500/50 border border-transparent transition-colors"/>
                      </div>
                    </div>

                 </div>
              )}
           </div>
        )}
        
        <button onClick={handleSubmit} disabled={isLoading} className={`w-full bg-white text-black font-bold text-[15px] py-4 rounded-full mt-2 transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] flex justify-center items-center tracking-wide ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-gray-200 hover:scale-[1.02]'}`}>
          {isLoading ? <svg className="animate-spin h-5 w-5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : "Daftarkan Kendaraan"}
        </button>
      </div>
    </main>
  );
}