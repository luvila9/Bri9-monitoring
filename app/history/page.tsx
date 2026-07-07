"use client";
import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function History() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [userUid, setUserUid] = useState<string | null>(null);
  const [totalBalance, setTotalBalance] = useState(0);
  
  // STATE PENCARIAN
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const generateMonths = () => {
    const result = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      let label = "";
      if (i === 0) label = "This month";
      else if (i === 1) label = "Last month";
      else label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      result.push({ key, label, year: d.getFullYear(), month: d.getMonth() });
    }
    return result;
  };

  const availableMonths = useMemo(() => generateMonths(), []);
  const [activeMonthKey, setActiveMonthKey] = useState<string>(availableMonths[availableMonths.length - 1].key);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) setUserUid(user.uid);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!userUid) return;
    const qTx = query(collection(db, "transactions"), where("userId", "==", userUid));
    const unsubTx = onSnapshot(qTx, (snapshot) => {
      const txList: any[] = [];
      let currentBalance = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        txList.push({ id: doc.id, ...data });
        // Hitung Saldo Utama Keseluruhan
        currentBalance += data.type === 'income' ? data.amount : -data.amount;
      });

      txList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(txList);
      setTotalBalance(currentBalance);
    });
    return () => unsubTx();
  }, [userUid]);

  const formatRupiah = (angka: number) => {
    const format = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
    return `${format},00`;
  };

  const getIcon = (cat: string, type: string) => {
    const iconClass = "w-5 h-5 text-gray-200";
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

  const { groupedData } = useMemo(() => {
    const selectedMonthObj = availableMonths.find(m => m.key === activeMonthKey);
    if (!selectedMonthObj) return { groupedData: {} };

    const filtered = transactions.filter(tx => {
      const d = new Date(tx.date);
      const isMatchMonth = d.getMonth() === selectedMonthObj.month && d.getFullYear() === selectedMonthObj.year;
      
      let isMatchSearch = true;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        isMatchSearch = (tx.note && tx.note.toLowerCase().includes(query)) || 
                        tx.category.toLowerCase().includes(query) || 
                        (tx.senderName && tx.senderName.toLowerCase().includes(query)) || 
                        (tx.receiverName && tx.receiverName.toLowerCase().includes(query));
      }

      return isMatchMonth && isMatchSearch;
    });

    const groups: Record<string, { dateObj: Date, total: number, txs: any[] }> = {};
    filtered.forEach(tx => {
      const d = new Date(tx.date);
      const dateStr = d.toISOString().split('T')[0];
      
      if (!groups[dateStr]) {
        groups[dateStr] = { dateObj: d, total: 0, txs: [] };
      }
      groups[dateStr].txs.push(tx);
      groups[dateStr].total += tx.type === 'income' ? tx.amount : -tx.amount;
    });

    return { groupedData: groups };
  }, [transactions, activeMonthKey, availableMonths, searchQuery]);

  const sortedDateKeys = Object.keys(groupedData).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <div className="min-h-screen bg-black select-none flex justify-center">
      <main className="w-full max-w-md min-h-screen bg-black text-white font-sans pb-32">
        
        {/* HEADER */}
        <header className="px-6 pt-10 pb-4 bg-black sticky top-0 z-40">
          <div className="flex justify-between items-center mb-6 relative">
            <div className="w-6"></div>
            <h1 className="text-[17px] font-semibold tracking-wide">Transactions</h1>
            
            <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="text-white hover:text-blue-400 transition-colors">
              {isSearchOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              )}
            </button>
          </div>

          {isSearchOpen && (
             <div className="mb-6 animate-in fade-in slide-in-from-top-2">
               <div className="flex items-center bg-[#1c1c1e] px-4 py-3 rounded-[1rem] border border-white/10 focus-within:border-blue-500/50 transition-colors">
                 <input 
                   type="text" 
                   autoFocus
                   placeholder="Cari nama, bank, atau kategori..." 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="bg-transparent border-none outline-none text-sm text-white w-full placeholder-gray-500"
                 />
               </div>
             </div>
          )}

          <div className="bg-[#1c1c1e] rounded-[1.5rem] p-5 flex items-center justify-between border border-white/5 shadow-xl mb-6">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                   <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                   <p className="text-[11px] text-gray-400 font-medium mb-0.5">Total Balance</p>
                   <p className={`text-xl font-bold tracking-wide ${totalBalance >= 0 ? 'text-white' : 'text-[#ff5252]'}`}>
                     {formatRupiah(totalBalance)}
                   </p>
                </div>
             </div>
          </div>

          <div className="flex gap-6 overflow-x-auto hide-scrollbar pb-1 border-b border-gray-800">
            {availableMonths.map(m => {
              const isActive = activeMonthKey === m.key;
              return (
                <button 
                  key={m.key}
                  onClick={() => { setActiveMonthKey(m.key); setSearchQuery(''); }}
                  className={`pb-3 text-[13px] font-semibold whitespace-nowrap transition-all relative ${isActive ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {m.label}
                  {isActive && <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-blue-500 rounded-t-full"></div>}
                </button>
              );
            })}
          </div>
        </header>

        {/* TRANSACTION LIST GROUPED BY DAY */}
        <section className="px-6 pt-2">
          {sortedDateKeys.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-16 text-gray-500">
               <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
               <p className="text-sm font-medium">Tidak ada transaksi tercatat.</p>
             </div>
          ) : (
            sortedDateKeys.map((dateKey) => {
              const group = groupedData[dateKey];
              const dateObj = group.dateObj;
              const isToday = new Date().toDateString() === dateObj.toDateString();
              
              const dayName = isToday ? 'Today' : dateObj.toLocaleDateString('en-US', { weekday: 'long' });
              const dayNumber = dateObj.toLocaleDateString('en-US', { day: '2-digit' });
              const monthYear = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

              return (
                <div key={dateKey} className="bg-[#151515] rounded-[1.5rem] border border-white/5 mb-5 overflow-hidden animate-in fade-in duration-300 shadow-lg">
                  
                  {/* HEADER HARI */}
                  <div className="px-5 pt-5 pb-3 flex justify-between items-center border-b border-gray-800/50">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-black text-white leading-none">{dayNumber}</span>
                      <div className="flex flex-col justify-center">
                        <span className="text-[13px] font-bold text-gray-200">{dayName}</span>
                        <span className="text-[10px] font-medium text-gray-500">{monthYear}</span>
                      </div>
                    </div>
                    <p className={`font-bold text-[14px] tracking-wide ${group.total >= 0 ? 'text-white' : 'text-[#ff5252]'}`}>
                      {group.total > 0 ? '+' : ''}{formatRupiah(group.total)}
                    </p>
                  </div>

                  {/* DAFTAR TRANSAKSI DETAIL */}
                  <div className="flex flex-col">
                    {group.txs.map((tx, idx) => {
                      const txDateObj = new Date(tx.date);
                      const timeStr = txDateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                      const dateStr = txDateObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                      const fullTimestamp = `${dateStr} ${timeStr} WIB`;

                      let titleText = tx.note;
                      if (!titleText) {
                         if (tx.type === 'income' && tx.senderName) titleText = `Dana Masuk dari ${tx.senderName}`;
                         else if (tx.type === 'expense' && tx.receiverName) titleText = `Pembayaran ke ${tx.receiverName}`;
                         else if (tx.category === 'Mutasi') titleText = 'Mutasi Saldo';
                         else titleText = tx.type === 'income' ? 'Dana Masuk' : 'Pengeluaran';
                      }

                      let subText = tx.paymentMethod === 'Cash' ? 'CASH' : 'SALDO DIGITAL';
                      if (tx.senderName && tx.note) subText = `Dari: ${tx.senderName} • ${subText}`;
                      else if (tx.receiverName && tx.note) subText = `Ke: ${tx.receiverName} • ${subText}`;
                      else subText = `${tx.category} • ${subText}`;

                      if (tx.investmentPlatform) subText += ` (${tx.investmentPlatform})`;

                      return (
                        <div 
                          key={tx.id} 
                          className={`flex justify-between items-center px-5 py-5 hover:bg-white/5 transition-colors ${idx !== 0 ? 'border-t border-gray-800/50' : ''}`}
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            
                            <div className="relative shrink-0">
                               <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${tx.type === 'income' ? 'bg-[#003b1e] border-[#006b36]' : 'bg-[#3b0b0b] border-[#6b1414]'}`}>
                                 {getIcon(tx.category, tx.type)}
                               </div>
                               <div className={`absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-[#151515] ${tx.type === 'income' ? 'bg-[#00e676]' : 'bg-[#ff5252]'}`}>
                                  <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" strokeWidth="4" viewBox="0 0 24 24">
                                     {tx.type === 'income' ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/> : <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4"/>}
                                  </svg>
                               </div>
                            </div>
                            
                            {/* CLASS TRUNCATE DIHAPUS, DIGANTI BREAK-WORDS AGAR BISA MEMBUNGKUS KE BAWAH */}
                            <div className="flex flex-col justify-center flex-1 min-w-0 pr-3">
                              <p className="font-semibold text-[15px] text-white capitalize break-words leading-snug mb-1">
                                {titleText}
                              </p>
                              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider break-words leading-snug mb-1">
                                {subText}
                              </p>
                              <p className="text-[10px] text-gray-500 font-medium">
                                {fullTimestamp}
                              </p>
                            </div>
                          </div>
                          
                          <div className="shrink-0 text-right ml-1 flex flex-col justify-center items-end">
                            <p className={`font-bold text-[15px] tracking-wide whitespace-nowrap ${tx.type === 'income' ? 'text-[#00e676]' : 'text-[#ff5252]'}`}>
                              {tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </section>
        
        <Navbar activeMenu="history" />
        <style jsx global>{`.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
      </main>
    </div>
  );
}