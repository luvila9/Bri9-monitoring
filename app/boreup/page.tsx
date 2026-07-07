"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function BoreUpCalculator() {
  const [pistonBore, setPistonBore] = useState('');
  const [stroke, setStroke] = useState('');
  const [cylinderCount, setCylinderCount] = useState('1');
  const [resultCC, setResultCC] = useState<number | null>(null);

  // Mencegah input selain angka dan desimal
  const handleNumberInput = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
    let val = e.target.value.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
    setter(val);
  };

  useEffect(() => {
    const bore = parseFloat(pistonBore);
    const strk = parseFloat(stroke);
    const cyl = parseInt(cylinderCount);

    if (bore > 0 && strk > 0 && cyl > 0) {
      // RUMUS MEKANIKA: Volume = (Pi / 4) * (D^2) * S * N
      // Karena input dalam milimeter (mm), kita bagi 1000 agar menjadi CC (cm^3)
      const pi = Math.PI;
      const volume = (pi / 4) * Math.pow(bore, 2) * strk * cyl / 1000;
      setResultCC(volume);
    } else {
      setResultCC(null);
    }
  }, [pistonBore, stroke, cylinderCount]);

  return (
    <main className="min-h-screen bg-black text-white font-sans p-6 relative overflow-hidden">
      
      {/* Background Ornamen Garasi */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[100px] -mr-40 -mt-20 pointer-events-none"></div>
      
      <header className="flex items-center mb-10 pt-2 relative z-10">
        <Link href="/">
          <button className="w-11 h-11 bg-[#1c1c1e] rounded-full flex items-center justify-center border border-gray-800 mr-4 hover:bg-gray-800 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
        </Link>
        <div>
          <h1 className="text-xl font-black tracking-wider uppercase text-red-500">Engine Build</h1>
          <p className="text-[11px] text-gray-500 font-medium">Bore Up & CC Calculator</p>
        </div>
      </header>

      <div className="flex flex-col gap-6 relative z-10">
        
        {/* LAYAR HASIL KALKULASI */}
        <div className="bg-gradient-to-br from-[#1c1c1e] to-[#0f0f11] rounded-[2.5rem] p-8 border border-white/5 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden min-h-[220px]">
          
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
          
          <p className="text-[10px] text-gray-400 font-bold tracking-[0.3em] uppercase mb-2 relative z-10">Total Displacement</p>
          
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-[4.5rem] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 leading-none">
              {resultCC ? resultCC.toFixed(1) : '0.0'}
            </span>
            <span className="text-xl font-bold text-red-500">CC</span>
          </div>

          {resultCC && (
            <div className="mt-6 px-4 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full animate-in zoom-in duration-300">
               <p className="text-[10px] text-red-400 font-bold">READY TO RACE 🏁</p>
            </div>
          )}
        </div>

        {/* INPUT SPESIFIKASI */}
        <div className="bg-[#1c1c1e] rounded-[2rem] p-6 border border-white/5 flex flex-col gap-5">
          
          {/* INFO GAMBAR SILINDER (Opsional pemanis) */}
          <div className="flex items-center gap-3 pb-4 border-b border-gray-800/50">
             <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
             </div>
             <div>
                <h2 className="text-sm font-bold text-white">Engine Specifications</h2>
                <p className="text-[10px] text-gray-500">Input data dalam satuan Milimeter (mm)</p>
             </div>
          </div>

          <div className="flex gap-4">
             <div className="flex-1">
               <label className="text-[11px] text-gray-400 font-bold ml-1 mb-2 block uppercase tracking-wider">Piston (Bore)</label>
               <div className="flex items-center bg-[#262629] p-4 rounded-2xl border border-transparent focus-within:border-red-500/50 transition-colors">
                 <input 
                   type="text" 
                   inputMode="decimal"
                   value={pistonBore}
                   onChange={(e) => handleNumberInput(e, setPistonBore)}
                   placeholder="53.5" 
                   className="w-full bg-transparent text-white font-bold outline-none text-base placeholder-gray-600"
                 />
                 <span className="text-gray-500 text-xs font-bold">mm</span>
               </div>
             </div>

             <div className="flex-1">
               <label className="text-[11px] text-gray-400 font-bold ml-1 mb-2 block uppercase tracking-wider">Langkah (Stroke)</label>
               <div className="flex items-center bg-[#262629] p-4 rounded-2xl border border-transparent focus-within:border-red-500/50 transition-colors">
                 <input 
                   type="text" 
                   inputMode="decimal"
                   value={stroke}
                   onChange={(e) => handleNumberInput(e, setStroke)}
                   placeholder="55.2" 
                   className="w-full bg-transparent text-white font-bold outline-none text-base placeholder-gray-600"
                 />
                 <span className="text-gray-500 text-xs font-bold">mm</span>
               </div>
             </div>
          </div>

          <div>
            <label className="text-[11px] text-gray-400 font-bold ml-1 mb-2 block uppercase tracking-wider">Jumlah Silinder</label>
            <div className="flex bg-[#262629] p-1.5 rounded-2xl border border-white/5">
              {['1', '2', '3', '4'].map((num) => (
                <button 
                  key={num}
                  type="button" 
                  onClick={() => setCylinderCount(num)} 
                  className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${cylinderCount === num ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'text-gray-500 hover:text-white'}`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
          
        </div>
        
        <div className="text-center px-4">
           <p className="text-[9px] text-gray-600 leading-relaxed font-medium">
             Kalkulator ini menggunakan rumus standar teknik mesin mekanika. Hasil yang ditampilkan adalah kapasitas murni (Displacement) di dalam ruang bakar.
           </p>
        </div>

      </div>
    </main>
  );
}