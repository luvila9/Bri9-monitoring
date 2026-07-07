"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Geolocation } from '@capacitor/geolocation';
import { registerPlugin } from '@capacitor/core';

const BackgroundGeolocation: any = registerPlugin('BackgroundGeolocation');

export default function SmartOdo() {
  const router = useRouter();
  const [hud, setHud] = useState<{ message: string, type: 'success' | 'error' | 'loading' } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [isVehicleDropdownOpen, setIsVehicleDropdownOpen] = useState(false);
  
  const [distanceKM, setDistanceKM] = useState('');
  const [note, setNote] = useState('');

  const [isTracking, setIsTracking] = useState(false);
  const [displayDistance, setDisplayDistance] = useState("0.00");
  const liveDistanceRef = useRef(0);
  const lastPosRef = useRef<{lat: number, lon: number} | null>(null);
  const watchIdRef = useRef<string | null>(null);
  
  // STATE KECEPATAN BARU
  const [speedMs, setSpeedMs] = useState(0); 
  const [speedKmh, setSpeedKmh] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const [avgSpeedFinal, setAvgSpeedFinal] = useState("0.0");

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const q = query(collection(db, "vehicles"), where("userId", "==", user.uid));
        const snap = await getDocs(q);
        const vList: any[] = [];
        snap.forEach(doc => vList.push(doc.data()));
        setVehicles(vList);
        if (vList.length > 0) setSelectedVehicle(vList[0].plate);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const trackingState = localStorage.getItem('bri9_isTracking');
    if (trackingState === 'true') {
       setIsTracking(true);
       const savedDist = localStorage.getItem('bri9_liveDistance') || "0.00";
       setDisplayDistance(savedDist);
       liveDistanceRef.current = parseFloat(savedDist);
       const savedWatcherId = localStorage.getItem('bri9_watcherId');
       if (savedWatcherId) watchIdRef.current = savedWatcherId;
    }
  }, []);

  const showHud = (message: string, type: 'success' | 'error' | 'loading' = 'error') => {
    setHud({ message, type });
    if (type !== 'loading') setTimeout(() => setHud(null), 2500);
  };

  const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
  };

  const startTracking = async () => {
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      lastPosRef.current = { lat: position.coords.latitude, lon: position.coords.longitude };
      
      setIsTracking(true); 
      liveDistanceRef.current = 0; 
      setDisplayDistance("0.00");
      
      startTimeRef.current = Date.now();
      localStorage.setItem('bri9_startTime', startTimeRef.current.toString());
      localStorage.setItem('bri9_isTracking', 'true');
      localStorage.setItem('bri9_liveDistance', '0.00');

      const watcherId = await BackgroundGeolocation.addWatcher(
        { backgroundMessage: "Sedang merekam jarak perjalanan Anda.", backgroundTitle: "Bri9 Smart Odo Aktif", requestPermissions: true, stale: false, distanceFilter: 10 },
        (location: any, error: any) => {
          if (error) return;
          if (location && lastPosRef.current) {
            
            // TANGKAP KECEPATAN DARI GPS
            const currentSpeedMs = location.speed && location.speed > 0 ? location.speed : 0;
            setSpeedMs(currentSpeedMs);
            setSpeedKmh(currentSpeedMs * 3.6); 

            const dist = getDistanceFromLatLonInKm(lastPosRef.current.lat, lastPosRef.current.lon, location.latitude, location.longitude);
            if (dist > 0.01) {
                liveDistanceRef.current += dist; 
                const newDistString = liveDistanceRef.current.toFixed(2);
                setDisplayDistance(newDistString);
                localStorage.setItem('bri9_liveDistance', newDistString);
                lastPosRef.current = { lat: location.latitude, lon: location.longitude };
            }
          }
        }
      );

      watchIdRef.current = watcherId;
      localStorage.setItem('bri9_watcherId', watcherId);
      showHud("Lacak GPS Berjalan", "success");
    } catch (error) { 
      setIsTracking(false); 
      localStorage.removeItem('bri9_isTracking');
      showHud("Gagal menyalakan GPS", "error"); 
    }
  };

  const stopTracking = async () => {
    if (watchIdRef.current !== null) { 
      await BackgroundGeolocation.removeWatcher({ id: watchIdRef.current }); 
      watchIdRef.current = null; 
    }
    setIsTracking(false);
    localStorage.removeItem('bri9_isTracking'); localStorage.removeItem('bri9_liveDistance'); localStorage.removeItem('bri9_watcherId');
    
    const finalDist = liveDistanceRef.current.toFixed(2);
    setDistanceKM(finalDist);

    // KALKULASI RATA-RATA KECEPATAN AKHIR
    let finalAvg = 0;
    const storedStart = localStorage.getItem('bri9_startTime');
    const startT = startTimeRef.current || (storedStart ? parseInt(storedStart) : Date.now());
    const durationHours = (Date.now() - startT) / (1000 * 60 * 60); 
    
    if (durationHours > 0 && liveDistanceRef.current > 0) {
       finalAvg = liveDistanceRef.current / durationHours; 
    }
    setAvgSpeedFinal(finalAvg.toFixed(1));
    localStorage.removeItem('bri9_startTime');

    showHud(`Jarak: ${finalDist} KM | Avg Speed: ${finalAvg.toFixed(1)} km/h`, "success");
  };

  const handleSubmit = async () => {
    if (!distanceKM.trim() || Number(distanceKM) <= 0) return showHud("Jarak tempuh (KM) wajib diisi", "error");
    if (!selectedVehicle) return showHud("Pilih kendaraan terlebih dahulu", "error");
    if (!note.trim()) return showHud("Tujuan perjalanan wajib diisi", "error");
    if (isTracking) return showHud("Matikan GPS sebelum menyimpan", "error");

    setIsLoading(true);
    try {
      const dist = parseFloat(distanceKM.replace(',', '.'));
      const logQ = query(collection(db, "vehicle_logs"), where("userId", "==", auth.currentUser?.uid));
      const logSnap = await getDocs(logQ);
      let currentOdo = 0;
      logSnap.forEach(docSnap => {
        const d = docSnap.data();
        if (d.plateNumber === selectedVehicle && d.odometer > currentOdo) currentOdo = d.odometer;
      });
      const newOdo = currentOdo + dist;

      await addDoc(collection(db, "vehicle_logs"), {
        plateNumber: selectedVehicle, 
        userId: auth.currentUser?.uid, 
        type: 'trip',
        odometer: newOdo, 
        distanceAdded: dist, 
        avgSpeedKmh: avgSpeedFinal, // SIMPAN KECEPATAN RATA-RATA
        date: new Date().toISOString(),
        createdAt: serverTimestamp(), 
        note: `Rute: ${note}`
      });

      showHud("Jarak berhasil ditambahkan!", "success");
      setTimeout(() => router.push('/'), 1500);
    } catch (error) { 
      showHud("Gagal menyimpan data.", "error"); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const activeVehicle = vehicles.find(v => v.plate === selectedVehicle);

  return (
    <main className="min-h-screen bg-black text-white font-sans p-6 pb-24 relative flex flex-col">
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

      <header className="flex items-center mb-10 pt-2">
        <Link href="/"><button className="w-11 h-11 bg-[#1c1c1e] rounded-full flex items-center justify-center border border-gray-800 mr-4 hover:bg-gray-800 transition"><svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button></Link>
        <h1 className="text-xl font-medium tracking-wide">Smart Odo</h1>
      </header>

      <div className="flex flex-col flex-1 gap-6 animate-in fade-in duration-300">
        
        <div className="bg-[#0f172a] rounded-[2.5rem] p-8 border border-blue-500/20 flex flex-col items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.1)] relative overflow-hidden">
           <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -ml-10 -mt-10"></div>
           <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4 z-10">Spidometer GPS</h4>
           <div className="flex items-end gap-2 z-10">
              <span className="text-[4rem] font-black text-white leading-none tracking-tighter">{displayDistance}</span>
              <span className="text-xl text-blue-400 font-bold mb-3">KM</span>
           </div>
           
           {/* UI SPIDOMETER TAMBAHAN */}
           <div className="flex justify-center items-center gap-6 mt-2 mb-4 opacity-90 z-10">
              <div className="text-center">
                 <p className="text-2xl font-black text-blue-400">{speedMs.toFixed(1)}</p>
                 <p className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">M / Detik</p>
              </div>
              <div className="w-[1px] h-6 bg-gray-700"></div>
              <div className="text-center">
                 <p className="text-2xl font-black text-white">{speedKmh.toFixed(1)}</p>
                 <p className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">KM / Jam</p>
              </div>
           </div>

           <div className="mt-4 w-full z-10">
              {isTracking ? (
                <button onClick={stopTracking} className="w-full bg-red-500/20 text-red-400 py-4 rounded-2xl font-bold text-[15px] hover:bg-red-500/30 transition-colors border border-red-500/30 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                  <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span> Selesai & Simpan
                </button>
              ) : (
                <button onClick={startTracking} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-[15px] hover:bg-blue-500 transition-colors shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg> Mulai Lacak
                </button>
              )}
           </div>
        </div>

        <div className="bg-[#1c1c1e] rounded-[2rem] p-6 border border-white/5 flex flex-col gap-5 shadow-xl mt-auto">
          
          <div className="flex gap-4">
             <div className="flex-1">
               <label className="text-[11px] text-gray-500 font-bold ml-1 mb-2 block uppercase tracking-wider">Jarak (KM)</label>
               <input type="text" inputMode="decimal" value={distanceKM} onChange={(e) => setDistanceKM(e.target.value)} placeholder="0.0" className="w-full bg-[#262629] text-white p-4 rounded-xl outline-none border border-transparent focus:border-blue-500/50 text-[15px] font-bold"/>
             </div>
             
             <div className="flex-[2] relative z-20">
               <label className="text-[11px] text-gray-500 font-bold ml-1 mb-2 block uppercase tracking-wider">Kendaraan</label>
               <button type="button" onClick={() => setIsVehicleDropdownOpen(!isVehicleDropdownOpen)} className="w-full bg-[#262629] text-white p-4 rounded-xl flex justify-between items-center text-[14px] border border-transparent focus:border-blue-500/50 transition-colors font-medium">
                 <span className="truncate pr-2">{activeVehicle ? activeVehicle.plate : 'Pilih Motor'}</span>
                 <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isVehicleDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
               </button>
               {isVehicleDropdownOpen && vehicles.length > 0 && (
                 <div className="absolute z-30 w-full mt-2 bg-[#2a2a2d] border border-gray-700/50 rounded-xl overflow-hidden shadow-2xl">
                   {vehicles.map((v: any) => (
                     <div key={v.plate} onClick={() => { setSelectedVehicle(v.plate); setIsVehicleDropdownOpen(false); }} className="p-4 text-sm font-medium text-gray-200 hover:bg-[#38383c] hover:text-white cursor-pointer transition-colors border-b border-gray-700/50 last:border-0">{v.name} ({v.plate})</div>
                   ))}
                 </div>
               )}
             </div>
          </div>

          <div>
            <label className="text-[11px] text-gray-500 font-bold ml-1 mb-2 block uppercase tracking-wider">Tujuan Perjalanan</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g., Pergi ke Kantor" className="w-full bg-[#262629] text-white p-4 rounded-xl outline-none border border-transparent focus:border-blue-500/50 text-[15px] font-medium"/>
          </div>

          <button onClick={handleSubmit} disabled={isLoading} type="button" className={`w-full bg-white text-black font-bold text-[15px] py-4 rounded-2xl mt-2 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] flex items-center justify-center ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-gray-200 hover:scale-[1.02]'}`}>
            {isLoading ? <svg className="animate-spin h-5 w-5 mr-3 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : "Simpan Jarak"}
          </button>
        </div>
      </div>
    </main>
  );
}