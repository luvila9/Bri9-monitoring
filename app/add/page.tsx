"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function AddTransaction() {
  const router = useRouter();
  const [userUid, setUserUid] = useState<string | null>(null);
  
  const [type, setType] = useState<'expense' | 'income' | 'mutasi'>('expense');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Transfer'>('Cash');
  const [mutasiDirection, setMutasiDirection] = useState<'bank_to_cash' | 'cash_to_bank'>('bank_to_cash');
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hud, setHud] = useState<{ message: string, type: 'success' | 'error' | 'loading' } | null>(null);
  
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState<string>('');

  const expenseCategories = ["Food & Drink", "Vehicle Maintenance", "Fuel", "Shopping", "Bills", "Investment", "Other"];
  const incomeCategories = ["Salary", "Allowance", "Bonus", "Investment", "Savings", "Other"];
  const currentCategories = type === 'expense' ? expenseCategories : incomeCategories;

  const [investmentPlatform, setInvestmentPlatform] = useState('');
  const [isInvDropdownOpen, setIsInvDropdownOpen] = useState(false);
  const investmentPlatforms = ["Bibit (Reksadana)", "Ajaib (Saham)", "Stockbit (Saham)", "Pluang", "Tokocrypto / Indodax", "Emas Fisik / Antam", "Deposito Bank", "Lainnya"];

  const [salarySource, setSalarySource] = useState('');
  
  const [savingsGoal, setSavingsGoal] = useState('');
  const [savingsTarget, setSavingsTarget] = useState('');
  const [existingSavingsGoals, setExistingSavingsGoals] = useState<{name: string, target: number}[]>([]);
  const [isSavingsDropdownOpen, setIsSavingsDropdownOpen] = useState(false);
  const [isNewSavings, setIsNewSavings] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => { if (user) setUserUid(user.uid); });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!userUid) return;
    const qTx = query(collection(db, "transactions"), where("userId", "==", userUid), where("category", "==", "Savings"));
    const unsubTx = onSnapshot(qTx, (snapshot) => {
       const goals: Record<string, number> = {};
       snapshot.forEach(doc => {
           const data = doc.data();
           if (data.savingsGoal) {
               if (!goals[data.savingsGoal]) goals[data.savingsGoal] = data.savingsTarget || 0;
               else if (data.savingsTarget && data.savingsTarget > goals[data.savingsGoal]) goals[data.savingsGoal] = data.savingsTarget;
           }
       });
       const goalsArray = Object.entries(goals).map(([name, target]) => ({name, target}));
       setExistingSavingsGoals(goalsArray);
       if (goalsArray.length > 0) setIsNewSavings(false); 
    });
    return () => unsubTx();
  }, [userUid]);

  useEffect(() => { setCategory(''); }, [type]);

  useEffect(() => {
    if (category !== 'Investment') setInvestmentPlatform('');
    if (category !== 'Salary') setSalarySource('');
    if (category !== 'Savings') {
      setSavingsGoal(''); setSavingsTarget(''); setIsSavingsDropdownOpen(false);
      if (existingSavingsGoals.length > 0) setIsNewSavings(false); 
      else setIsNewSavings(true);
    }
    if (category === 'Investment') setPaymentMethod('Transfer');
  }, [category, existingSavingsGoals.length]);

  const showHud = (message: string, type: 'success' | 'error' | 'loading' = 'error') => {
    setHud({ message, type });
    if (type !== 'loading') setTimeout(() => setHud(null), 2500);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, ''); 
    setAmount(rawValue.replace(/\B(?=(\d{3})+(?!\d))/g, "."));
  };

  const handleSavingsTargetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, ''); 
    setSavingsTarget(rawValue.replace(/\B(?=(\d{3})+(?!\d))/g, "."));
  };

  const handleSubmit = async () => {
    const parsedAmount = Number(amount.replace(/\./g, ''));
    if (!parsedAmount || parsedAmount <= 0) return showHud("Masukkan nominal yang valid", "error");
    
    if (type === 'mutasi') {
        setIsLoading(true);
        try {
            const sourceMethod = mutasiDirection === 'bank_to_cash' ? 'Transfer' : 'Cash';
            const destMethod = mutasiDirection === 'bank_to_cash' ? 'Cash' : 'Transfer';
            const noteText = note.trim() || (mutasiDirection === 'bank_to_cash' ? 'Tarik Tunai ATM/VA' : 'Setor Tunai');

            await addDoc(collection(db, "transactions"), { type: 'expense', amount: parsedAmount, category: 'Mutasi', note: noteText, receiptUrl: null, date: new Date().toISOString(), createdAt: serverTimestamp(), userId: auth.currentUser?.uid, paymentMethod: sourceMethod });
            await addDoc(collection(db, "transactions"), { type: 'income', amount: parsedAmount, category: 'Mutasi', note: noteText, receiptUrl: null, date: new Date().toISOString(), createdAt: serverTimestamp(), userId: auth.currentUser?.uid, paymentMethod: destMethod });

            showHud("Mutasi Saldo Berhasil!", "success"); setTimeout(() => router.push('/'), 1500);
        } catch (e) { showHud("Gagal menyimpan mutasi.", "error"); } finally { setIsLoading(false); }
        return;
    }

    if (!category) return showHud("Kategori transaksi wajib dipilih!", "error");
    
    if (category === 'Investment' && !investmentPlatform) return showHud("Platform investasi wajib dipilih!", "error");
    if (category === 'Salary' && !salarySource.trim()) return showHud("Nama Perusahaan wajib diisi!", "error");
    if (category === 'Savings') {
       if (!savingsGoal.trim()) return showHud("Tujuan Tabungan wajib dipilih/diisi!", "error");
       // Validasi target hanya jika ini tabungan BARU
       if (isNewSavings && !savingsTarget) return showHud("Target Tabungan wajib diisi!", "error");
    }
    if (!note.trim()) return showHud("Deskripsi transaksi wajib diisi!", "error");

    setIsLoading(true);
    try {
      const extraData: any = {};
      if (category === 'Investment') extraData.investmentPlatform = investmentPlatform;
      if (category === 'Salary') extraData.salarySource = salarySource;
      if (category === 'Savings') {
          extraData.savingsGoal = savingsGoal;
          // Menyimpan Target: Jika baru pakai inputan, jika lama ambil dari state yang sudah ter-copy
          extraData.savingsTarget = Number(savingsTarget.replace(/\./g, ''));
      }

      await addDoc(collection(db, "transactions"), {
        type: type, amount: parsedAmount, category: category, note: note, receiptUrl: null, 
        date: new Date().toISOString(), createdAt: serverTimestamp(), userId: auth.currentUser?.uid, paymentMethod: paymentMethod, ...extraData 
      });
      showHud("Data berhasil disimpan!", "success");
      setTimeout(() => router.push('/'), 1500);
    } catch (error) { showHud("Gagal menyimpan data.", "error"); } 
    finally { setIsLoading(false); }
  };

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
        <h1 className="text-xl font-medium tracking-wide">Konfirmasi</h1>
      </header>

      <div className="flex bg-[#1c1c1e] rounded-full p-1.5 mb-10 border border-white/5 shadow-inner mx-auto w-full max-w-[320px]">
        <button onClick={() => setType('expense')} className={`flex-1 py-3 rounded-full text-[12px] font-bold transition-all ${type === 'expense' ? 'bg-white text-black shadow-lg scale-[1.02]' : 'text-gray-400 hover:text-white'}`}>Expense</button>
        <button onClick={() => setType('income')} className={`flex-1 py-3 rounded-full text-[12px] font-bold transition-all ${type === 'income' ? 'bg-white text-black shadow-lg scale-[1.02]' : 'text-gray-400 hover:text-white'}`}>Income</button>
        <button onClick={() => setType('mutasi')} className={`flex-1 py-3 rounded-full text-[12px] font-bold transition-all ${type === 'mutasi' ? 'bg-white text-black shadow-lg scale-[1.02]' : 'text-gray-400 hover:text-white'}`}>Tukar Saldo</button>
      </div>

      <div className="flex flex-col flex-1 gap-7 animate-in fade-in duration-300">
        
        <div className="flex flex-col items-center justify-center py-2">
          <p className="text-blue-400 text-sm mb-3 font-semibold tracking-widest uppercase">Amount</p>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-semibold text-gray-500">Rp</span>
            <input type="text" inputMode="numeric" value={amount} onChange={handleAmountChange} placeholder="0" className="bg-transparent text-[4rem] font-bold text-white w-full text-center outline-none placeholder-gray-800 tracking-tight appearance-none"/>
          </div>
        </div>

        <div className="bg-[#1c1c1e] rounded-[2.5rem] p-6 border border-white/5 flex flex-col gap-5 shadow-2xl mt-auto">
          
          {type === 'mutasi' && (
             <div className="flex bg-[#262629] rounded-2xl p-1 border border-white/5">
                <button type="button" onClick={() => setMutasiDirection('bank_to_cash')} className={`flex-1 py-3 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 ${mutasiDirection === 'bank_to_cash' ? 'bg-emerald-500/10 text-emerald-400 shadow-sm border border-emerald-500/20' : 'text-gray-500 hover:text-gray-300'}`}>
                   <span className="text-xl mb-1">🏧</span> Tarik Tunai (Ke Cash)
                </button>
                <button type="button" onClick={() => setMutasiDirection('cash_to_bank')} className={`flex-1 py-3 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 ${mutasiDirection === 'cash_to_bank' ? 'bg-blue-500/10 text-blue-400 shadow-sm border border-blue-500/20' : 'text-gray-500 hover:text-gray-300'}`}>
                   <span className="text-xl mb-1">🏦</span> Setor Tunai (Ke Bank)
                </button>
             </div>
          )}

          {type !== 'mutasi' && (
             <div className="flex bg-[#262629] rounded-2xl p-1 border border-white/5">
                <button type="button" onClick={() => setPaymentMethod('Cash')} className={`flex-1 py-3 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${paymentMethod === 'Cash' ? 'bg-emerald-500/10 text-emerald-400 shadow-sm border border-emerald-500/20' : 'text-gray-500 hover:text-gray-300'}`}>
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg> Uang Cash
                </button>
                <button type="button" onClick={() => setPaymentMethod('Transfer')} className={`flex-1 py-3 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 ${paymentMethod === 'Transfer' ? 'bg-blue-500/10 text-blue-400 shadow-sm border border-blue-500/20' : 'text-gray-500 hover:text-gray-300'}`}>
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg> Transfer / E-Wallet
                </button>
             </div>
          )}

          {type !== 'mutasi' && (
             <div className="relative z-30">
               <label className="text-xs text-gray-500 ml-1 mb-2 block font-medium">Pilih Kategori <span className="text-red-500">*</span></label>
               <button type="button" onClick={() => setIsDropdownOpen(!isDropdownOpen)} className={`w-full bg-[#262629] p-4 rounded-2xl flex justify-between items-center text-[15px] border border-transparent focus:border-gray-600 transition-colors font-medium ${category ? 'text-white' : 'text-gray-500'}`}>
                 {category || 'Pilih Kategori...'} <svg className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
               </button>
               {isDropdownOpen && (
                 <div className="absolute z-40 w-full mt-2 bg-[#2a2a2d] border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto">
                   {currentCategories.map((cat: string, index: number) => (
                     <div key={index} onClick={() => { setCategory(cat); setIsDropdownOpen(false); }} className="p-4 text-[14px] font-medium text-gray-200 hover:bg-[#38383c] hover:text-white cursor-pointer transition-colors border-b border-gray-700/50 last:border-0">{cat}</div>
                   ))}
                 </div>
               )}
             </div>
          )}

          {category === 'Investment' && (
             <div className="relative z-20 mt-[-10px] animate-in fade-in slide-in-from-top-2 duration-200">
               <label className="text-xs text-gray-500 ml-1 mb-2 block font-medium">Platform Investasi <span className="text-red-500">*</span></label>
               <button type="button" onClick={() => setIsInvDropdownOpen(!isInvDropdownOpen)} className={`w-full bg-blue-900/20 p-4 rounded-2xl flex justify-between items-center text-[15px] border border-blue-500/20 transition-colors font-medium ${investmentPlatform ? 'text-blue-100' : 'text-blue-400/50'}`}>
                 {investmentPlatform || 'Pilih Platform...'} <svg className={`w-4 h-4 text-blue-400 transition-transform ${isInvDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
               </button>
               {isInvDropdownOpen && (
                 <div className="absolute z-40 w-full mt-2 bg-[#1c2c4c] border border-blue-500/30 rounded-2xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto">
                   {investmentPlatforms.map((plat, index) => (
                     <div key={index} onClick={() => { setInvestmentPlatform(plat); setIsInvDropdownOpen(false); }} className="p-4 text-[14px] font-medium text-blue-100 hover:bg-blue-600/50 hover:text-white cursor-pointer transition-colors border-b border-blue-500/20 last:border-0">{plat}</div>
                   ))}
                 </div>
               )}
             </div>
          )}

          {category === 'Salary' && (
             <div className="relative z-20 mt-[-10px] animate-in fade-in slide-in-from-top-2 duration-200">
               <label className="text-xs text-gray-500 ml-1 mb-2 block font-medium">Nama Perusahaan / Instansi <span className="text-red-500">*</span></label>
               <input type="text" value={salarySource} onChange={(e) => setSalarySource(e.target.value)} placeholder="Contoh: PT. Sumber Makmur" className="w-full bg-[#262629] text-white p-4 rounded-2xl outline-none border border-transparent focus:border-green-500/50 text-[15px] font-medium transition-colors" />
             </div>
          )}

          {category === 'Savings' && (
             <div className="relative z-20 mt-[-10px] animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col gap-5">
               <div className="relative">
                 <label className="text-xs text-gray-500 ml-1 mb-2 block font-medium">Tujuan Tabungan <span className="text-red-500">*</span></label>
                 
                 {!isNewSavings && existingSavingsGoals.length > 0 ? (
                    <>
                       <button type="button" onClick={() => setIsSavingsDropdownOpen(!isSavingsDropdownOpen)} className={`w-full bg-[#262629] p-4 rounded-2xl flex justify-between items-center text-[15px] border border-transparent focus:border-teal-500/50 transition-colors font-medium ${savingsGoal ? 'text-white' : 'text-gray-500'}`}>
                         {savingsGoal || 'Pilih Target yang Sudah Ada...'} <svg className={`w-4 h-4 text-gray-400 transition-transform ${isSavingsDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                       </button>
                       {isSavingsDropdownOpen && (
                         <div className="absolute z-40 w-full mt-2 bg-[#2a2a2d] border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto">
                           {existingSavingsGoals.map((goal, idx) => (
                             <div key={idx} onClick={() => { 
                                 setSavingsGoal(goal.name); 
                                 setSavingsTarget(goal.target.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")); 
                                 setIsSavingsDropdownOpen(false); 
                             }} className="p-4 text-[14px] font-medium text-gray-200 hover:bg-[#38383c] hover:text-white cursor-pointer transition-colors border-b border-gray-700/50">
                               {goal.name}
                             </div>
                           ))}
                           <div onClick={() => { setSavingsGoal(''); setSavingsTarget(''); setIsSavingsDropdownOpen(false); setIsNewSavings(true); }} className="p-4 text-[14px] font-bold text-teal-400 hover:bg-[#38383c] hover:text-teal-300 cursor-pointer transition-colors flex items-center gap-2">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg> Buat Target Baru
                           </div>
                         </div>
                       )}
                    </>
                 ) : (
                    <div className="flex items-center gap-2">
                      <input type="text" value={savingsGoal} onChange={(e) => setSavingsGoal(e.target.value)} placeholder="Contoh: Dana Darurat / Servis Motor" className="w-full bg-[#262629] text-white p-4 rounded-2xl outline-none border border-transparent focus:border-teal-500/50 text-[15px] font-medium transition-colors" />
                      
                      {existingSavingsGoals.length > 0 && (
                         <button type="button" onClick={() => { setIsNewSavings(false); setSavingsGoal(''); setSavingsTarget(''); }} className="shrink-0 bg-[#262629] w-14 h-[54px] rounded-2xl flex items-center justify-center text-gray-400 hover:text-white border border-transparent transition-colors">
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                         </button>
                      )}
                    </div>
                 )}
               </div>
               
               {/* HANYA MUNCUL JIKA MEMBUAT TABUNGAN BARU (ATAU BELUM PUNYA TABUNGAN) */}
               {(isNewSavings || existingSavingsGoals.length === 0) && (
                 <div className="animate-in fade-in zoom-in-95 duration-200">
                   <label className="text-xs text-gray-500 ml-1 mb-2 block font-medium">Target Nominal Tabungan <span className="text-red-500">*</span></label>
                   <div className="flex items-center gap-3 bg-[#262629] rounded-2xl p-4 border border-transparent focus-within:border-teal-500/50 transition-colors">
                      <span className="text-gray-400 font-semibold">Rp</span>
                      <input type="text" inputMode="numeric" value={savingsTarget} onChange={handleSavingsTargetChange} placeholder="Contoh: 15.000.000" className="bg-transparent text-white font-bold w-full outline-none" />
                   </div>
                   <p className="text-[10px] text-gray-500 mt-2 ml-1">Sistem akan membuatkan persentase progress bar di Dashboard.</p>
                 </div>
               )}
             </div>
          )}

          <div>
            <label className="text-xs text-gray-500 ml-1 mb-2 block font-medium">Deskripsi Transaksi <span className="text-red-500">*</span></label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === 'mutasi' ? "e.g., Tarik Tunai ATM BCA" : category === 'Investment' ? "e.g., Beli Saham BBCA / Top Up Reksadana" : category === 'Salary' ? "e.g., Gaji Bulan Juli" : category === 'Savings' ? "e.g., Setor Tabungan Bulan Ini" : "e.g., Uang Makan / Beli Bensin"} className="w-full bg-[#262629] text-white p-4 rounded-2xl outline-none border border-transparent focus:border-gray-500 text-[15px] font-medium placeholder-gray-500"/>
          </div>

          <button onClick={handleSubmit} disabled={isLoading} type="button" className={`w-full bg-blue-600 text-white font-bold text-[16px] py-4 rounded-2xl mt-1 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] flex items-center justify-center ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-500 hover:scale-[1.02]'}`}>
            {isLoading ? <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : "Simpan Transaksi"}
          </button>
        </div>
      </div>
    </main>
  );
}