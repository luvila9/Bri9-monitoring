"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const CHART_COLORS = ['#06b6d4', '#d946ef', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#3b82f6'];

const getMonthName = (monthIndex: number) => {
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return months[monthIndex];
};

export default function Analytics() {
  const router = useRouter();
  const [userUid, setUserUid] = useState<string | null>(null);
  
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState<'spending' | 'income'>('spending');
  const [categoryData, setCategoryData] = useState<{name: string, amount: number, color: string, percentage: number}[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);

  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpense, setMonthlyExpense] = useState(0);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) setUserUid(user.uid);
      else router.push('/login');
    });
    return () => unsubAuth();
  }, [router]);

  useEffect(() => {
    if (!userUid) return;
    const qTx = query(collection(db, "transactions"), where("userId", "==", userUid));
    const unsubTx = onSnapshot(qTx, (snapshot) => {
      const txList: any[] = [];
      snapshot.forEach((doc) => txList.push({ id: doc.id, ...doc.data() }));
      txList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAllTransactions(txList);
    });
    return () => unsubTx();
  }, [userUid]);

  useEffect(() => {
    const monthlyFiltered = allTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate.getMonth() === selectedMonth && txDate.getFullYear() === selectedYear;
    });

    let mIncome = 0;
    let mExpense = 0;
    monthlyFiltered.forEach(tx => {
       if (tx.type === 'income') mIncome += tx.amount;
       else mExpense += tx.amount;
    });
    setMonthlyIncome(mIncome);
    setMonthlyExpense(mExpense);

    const typeFiltered = monthlyFiltered.filter(t => activeTab === 'spending' ? t.type === 'expense' : t.type === 'income');
    setFilteredTransactions(typeFiltered);
    
    let total = 0;
    const grouped: Record<string, number> = {};
    
    typeFiltered.forEach(tx => {
      total += tx.amount;
      if (grouped[tx.category]) grouped[tx.category] += tx.amount;
      else grouped[tx.category] = tx.amount;
    });

    const catArray = Object.keys(grouped).map((key, index) => ({
      name: key,
      amount: grouped[key],
      percentage: total === 0 ? 0 : (grouped[key] / total) * 100,
      color: CHART_COLORS[index % CHART_COLORS.length]
    })).sort((a, b) => b.amount - a.amount);

    setTotalAmount(total);
    setCategoryData(catArray);
  }, [allTransactions, activeTab, selectedMonth, selectedYear]);

  const formatRupiah = (angka: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);

  const getIcon = (cat: string, type: string) => {
    const iconClass = "w-5 h-5 text-gray-300";
    let d = "";
    switch (cat) {
      case 'Investment': d = "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"; break;
      case 'Bonus': d = "M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"; break;
      case 'Savings': d = "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"; break;
      case 'Salary': d = "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"; break;
      case 'Allowance': d = "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"; break;
      case 'Food & Drink': d = "M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z"; break;
      case 'Shopping': d = "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"; break;
      case 'Bills': d = "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"; break;
      case 'Fuel': 
      case 'Vehicle Maintenance': d = "M13 10V3L4 14h7v7l9-11h-7z"; break;
      case 'Other': d = "M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"; break;
      default:
        d = type === 'income' ? "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" : "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"; 
    }
    return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
  };

  let currentPercentage = 0;
  const gradientStops = categoryData.map(cat => {
    const start = currentPercentage;
    const end = currentPercentage + cat.percentage;
    currentPercentage = end;
    return `${cat.color} ${start}% ${end}%`;
  }).join(', ');
  
  const chartStyle = categoryData.length > 0 ? `conic-gradient(${gradientStops})` : 'conic-gradient(#333 0% 100%)';

  return (
    <main className="min-h-screen bg-black text-white font-sans pb-32 relative">
      <header className="flex justify-between items-center px-6 pt-10 mb-6">
        <div className="w-6"></div> 
        <h1 className="text-[17px] font-semibold tracking-wide">Analytics</h1>
        <button className="text-gray-500 hover:text-blue-400 transition-colors">
          <svg className="w-5 h-5 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </button>
      </header>

      <div className="px-6 mb-6">
        <div className="relative z-50">
          <button 
            onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
            className="flex items-center gap-2 bg-[#1c1c1e] px-4 py-2.5 rounded-full border border-white/5 text-sm font-medium hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            {getMonthName(selectedMonth)} {selectedYear}
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${isMonthDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>

          {isMonthDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-[#1c1c1e] border border-gray-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
              <div className="max-h-60 overflow-y-auto hide-scrollbar">
                {[...Array(12)].map((_, i) => {
                  const monthName = getMonthName(i);
                  const isSelected = selectedMonth === i;
                  return (
                    <button 
                      key={i}
                      onClick={() => { setSelectedMonth(i); setIsMonthDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors border-b border-gray-800/50 last:border-0 ${isSelected ? 'bg-blue-500/10 text-blue-400 font-semibold' : 'text-gray-300 hover:bg-[#252528]'}`}
                    >
                      {monthName} {currentYear}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =======================================================
          KARTU REKAPITULASI (DESAIN 2 BARIS ANTI TABRAKAN)
      ======================================================= */}
      <div className="px-6 mb-8">
        <div className="bg-[#151515] p-5 rounded-[1.5rem] border border-white/5 shadow-lg flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Pemasukan</span>
              <span className="text-[15px] font-bold text-green-400">+{formatRupiah(monthlyIncome)}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Pengeluaran</span>
              <span className="text-[15px] font-bold text-red-400">-{formatRupiah(monthlyExpense)}</span>
            </div>
          </div>
          <div className="h-[1px] w-full bg-gray-800/60"></div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">Sisa (Net)</span>
            <span className={`text-lg font-bold tracking-wide ${monthlyIncome - monthlyExpense >= 0 ? 'text-blue-400' : 'text-red-500'}`}>
              {formatRupiah(monthlyIncome - monthlyExpense)}
            </span>
          </div>
        </div>
      </div>

      <div className="px-6 mb-8">
        <div className="bg-[#1c1c1e] p-1 rounded-full flex">
          <button onClick={() => setActiveTab('spending')} className={`flex-1 py-2.5 text-sm font-medium rounded-full transition-all ${activeTab === 'spending' ? 'bg-white text-black shadow-md' : 'text-gray-400'}`}>Spending</button>
          <button onClick={() => setActiveTab('income')} className={`flex-1 py-2.5 text-sm font-medium rounded-full transition-all ${activeTab === 'income' ? 'bg-white text-black shadow-md' : 'text-gray-400'}`}>Income</button>
        </div>
      </div>

      <section className="flex flex-col items-center justify-center mb-10 px-6">
        <div className="relative flex items-center justify-center w-56 h-56 rounded-full transition-all duration-500" style={{ background: chartStyle }}>
          <div className="absolute w-44 h-44 bg-black rounded-full flex flex-col items-center justify-center shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)]">
            <span className="text-[20px] font-bold tracking-tight">{formatRupiah(totalAmount)}</span>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-4 mt-8 text-[11px] font-medium text-gray-400 px-4">
          {categoryData.length === 0 ? <span>Belum ada transaksi di bulan ini</span> : 
            categoryData.map(cat => (
              <span key={cat.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: cat.color }}></span> 
                {cat.name}
              </span>
          ))}
        </div>
      </section>

      <section className="px-6">
        <h3 className="text-sm font-medium text-white/90 mb-4">
          Recent transactions ({getMonthName(selectedMonth)})
        </h3>
        <div className="bg-[#1c1c1e] rounded-[1.5rem] p-3 flex flex-col gap-1 border border-white/5">
          {filteredTransactions.slice(0, 5).map((tx, idx) => (
            <div key={tx.id} className={`flex justify-between items-center p-3 rounded-xl hover:bg-white/5 transition-colors ${idx !== 0 ? 'border-t border-gray-800/50' : ''}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/5">
                  {getIcon(tx.category, tx.type)}
                </div>
                <div>
                  <p className="font-medium text-sm text-white capitalize">{tx.investmentPlatform || tx.salarySource || tx.bonusSource || tx.savingsGoal || tx.allowanceType || tx.note || tx.category}</p>
                  <p className="text-[11px] text-gray-500">{tx.category} • {new Date(tx.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</p>
                </div>
              </div>
              <p className={`font-semibold text-sm ${tx.type === 'income' ? 'text-green-400' : 'text-white'}`}>
                {tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}
              </p>
            </div>
          ))}
          {filteredTransactions.length === 0 && (
             <p className="text-center text-gray-500 text-xs py-6">Tidak ada transaksi tercatat pada bulan {getMonthName(selectedMonth)}.</p>
          )}
        </div>
      </section>

      <Navbar activeMenu="analytics" />
    </main>
  );
}