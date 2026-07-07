"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { db, auth } from '@/lib/firebase';
// MENGIMPOR deleteDoc DI SINI
import { collection, query, where, onSnapshot, doc, setDoc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import AiReminder from '@/components/AiReminder';

interface VehicleStats { kml: string; highestOdo: number; remainingOil: number; hasOilData: boolean; }

const expenseCategories = ["Food & Drink", "Vehicle Maintenance", "Fuel", "Shopping", "Bills", "Other"];
const incomeCategories = ["Salary", "Allowance", "Bonus", "Investment", "Savings", "Other"];

export default function Dashboard() {
  const router = useRouter();
  const [userUid, setUserUid] = useState<string | null>(null);
  const [userName, setUserName] = useState('User');
  const [profilePic, setProfilePic] = useState<string | null>(null); 
  const [transactions, setTransactions] = useState<any[]>([]);
  
  const [balance, setBalance] = useState(0);
  const [cashBalance, setCashBalance] = useState(0);
  const [transferBalance, setTransferBalance] = useState(0);

  const [investmentBalance, setInvestmentBalance] = useState(0); 
  const [bonusBalance, setBonusBalance] = useState(0);
  const [savingsBalance, setSavingsBalance] = useState(0);

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [allVehicleStats, setAllVehicleStats] = useState<Record<string, VehicleStats>>({});

  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [newBank, setNewBank] = useState({ bankName: '', accountNumber: '', accountName: '' });
  const [isSavingBank, setIsSavingBank] = useState(false);
  
  const [activeBankCard, setActiveBankCard] = useState(0);
  const [activeFinanceCard, setActiveFinanceCard] = useState(0);
  const [activeVehicleCard, setActiveVehicleCard] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  const [aiAdvice, setAiAdvice] = useState<string>("Sedang menganalisis data keuanganmu...");
  const [savingsGoalsList, setSavingsGoalsList] = useState<Record<string, { current: number, target: number }>>({});
  const [activeSavingsIndex, setActiveSavingsIndex] = useState(0);
  
  const [currentMonthStats, setCurrentMonthStats] = useState({ expense: 0, income: 0, fuel: 0, food: 0, bal: 0 });
  const [hud, setHud] = useState<{ message: string, type: 'success' | 'error' | 'loading' } | null>(null);

  const [autoProcessModal, setAutoProcessModal] = useState<{ isOpen: boolean, bankName: string } | null>(null);
  const [inlineTx, setInlineTx] = useState<{ type: 'expense' | 'income' | 'mutasi', amount: string, note: string, senderReceiverName: string, detectedBank: string, mutasiDirection?: 'bank_to_cash' | 'cash_to_bank' } | null>(null);
  const [inlineCategory, setInlineCategory] = useState('');
  const [isInlineDropdownOpen, setIsInlineDropdownOpen] = useState(false);
  const [isInlineSaving, setIsInlineSaving] = useState(false);
  const [isInlineTypeOpen, setIsInlineTypeOpen] = useState(false); 

  const showHud = (message: string, type: 'success' | 'error' | 'loading' = 'success') => {
    setHud({ message, type });
    if (type !== 'loading') setTimeout(() => setHud(null), 2500);
  };

  // === FUNGSI HAPUS TRANSAKSI ===
  const handleDeleteTransaction = async (id: string) => {
    const isConfirmed = window.confirm("Apakah Anda yakin ingin menghapus transaksi ini? (Saldo Anda akan otomatis terkoreksi kembali)");
    if (!isConfirmed) return;

    try {
      await deleteDoc(doc(db, "transactions", id));
      showHud("Transaksi berhasil dihapus!", "success");
    } catch (error) {
      console.error("Gagal menghapus:", error);
      showHud("Gagal menghapus transaksi.", "error");
    }
  };

  const setupDailyNotifications = async () => {
    try {
      const permStatus = await LocalNotifications.requestPermissions();
      if (permStatus.display === 'granted') {
        await LocalNotifications.cancel({ notifications: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] });
        await LocalNotifications.schedule({
          notifications: [
            { id: 1, title: "Selamat Pagi! 🌅", body: "Yuk rencanakan pengeluaranmu hari ini agar dompet tetap aman!", schedule: { on: { hour: 6, minute: 0 } } },
            { id: 2, title: "Waktunya Makan Siang! 🍽️", body: "Jangan lupa catat pengeluaran makanmu ya!", schedule: { on: { hour: 12, minute: 0 } } },
            { id: 3, title: "Sore Santai ☕", body: "Lagi jajan sore? Yuk catat pengeluaran recehmu agar tak bocor halus!", schedule: { on: { hour: 16, minute: 30 } } },
            { id: 4, title: "Rekap Keuangan Harian 🌙", body: "Waktunya istirahat! Pastikan semua transaksimu hari ini sudah tercatat.", schedule: { on: { hour: 20, minute: 0 } } }
          ]
        });
      }
    } catch (error) { console.log("Notifikasi lokal aman di browser."); }
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) router.push('/login');
      else {
        setUserUid(user.uid);
        const savedName = localStorage.getItem('bri9_username') || user.email?.split('@')[0] || 'User';
        setUserName(savedName);
        setNewBank(prev => ({ ...prev, accountName: savedName })); 
        setProfilePic(localStorage.getItem('bri9_profile_pic'));
        if (localStorage.getItem('bri9_notif') !== 'false') setupDailyNotifications();
        try { await Geolocation.requestPermissions(); await Camera.requestPermissions(); } catch (error) {}
      }
    });
    return () => unsubAuth();
  }, [router]);

  useEffect(() => {
    if (!userUid) return;

    const unsubUser = onSnapshot(doc(db, "users", userUid), (docSnap) => {
       if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.name) { setUserName(data.name); localStorage.setItem('bri9_username', data.name); }
          if (data.profilePic) { setProfilePic(data.profilePic); localStorage.setItem('bri9_profile_pic', data.profilePic); }
       }
    });

    const qTx = query(collection(db, "transactions"), where("userId", "==", userUid));
    const unsubTx = onSnapshot(qTx, (snapshot) => {
      let totBal = 0, totInv = 0, totBonus = 0, totSav = 0, totCash = 0, totTransfer = 0;
      let fuelExpense = 0, foodExpense = 0, totalExpense = 0, totalIncome = 0;
      const txList: any[] = [];
      const goalsTemp: Record<string, { current: number, target: number }> = {};
      const currentMonth = new Date().getMonth();

      snapshot.forEach((doc) => {
        const data = doc.data(); txList.push({ id: doc.id, ...data });
        const isCurrentMonth = new Date(data.date).getMonth() === currentMonth;

        if (data.category === 'Savings') {
           totSav += data.type === 'income' ? data.amount : -data.amount;
           if (data.savingsGoal) {
              if (!goalsTemp[data.savingsGoal]) goalsTemp[data.savingsGoal] = { current: 0, target: data.savingsTarget || 5000000 };
              goalsTemp[data.savingsGoal].current += (data.type === 'income' ? data.amount : -data.amount);
              if (data.savingsTarget && data.savingsTarget > goalsTemp[data.savingsGoal].target) goalsTemp[data.savingsGoal].target = data.savingsTarget;
           }
        } else if (data.category === 'Investment') totInv += data.type === 'income' ? data.amount : -data.amount;
        else if (data.category === 'Bonus') totBonus += data.type === 'income' ? data.amount : -data.amount;
        else {
           const amt = data.amount; const method = data.paymentMethod || 'Transfer';
           if (data.type === 'income') { totBal += amt; if (method === 'Cash') totCash += amt; else totTransfer += amt; if (isCurrentMonth) totalIncome += amt; }
           else { totBal -= amt; if (method === 'Cash') totCash -= amt; else totTransfer -= amt; if (isCurrentMonth) { totalExpense += amt; if (data.category === 'Fuel') fuelExpense += amt; if (data.category === 'Food & Drink') foodExpense += amt; } }
        }
      });
      
      txList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(txList); setBalance(totBal); setCashBalance(totCash); setTransferBalance(totTransfer); 
      setInvestmentBalance(totInv); setBonusBalance(totBonus); setSavingsBalance(totSav); setSavingsGoalsList(goalsTemp);
      setCurrentMonthStats({ expense: totalExpense, income: totalIncome, fuel: fuelExpense, food: foodExpense, bal: totBal });
    });

    const qVehicles = query(collection(db, "vehicles"), where("userId", "==", userUid));
    const unsubVehicles = onSnapshot(qVehicles, (snapshot) => {
      const vList: any[] = []; snapshot.forEach(doc => vList.push(doc.data())); setVehicles(vList);
    });

    const qLogs = query(collection(db, "vehicle_logs"), where("userId", "==", userUid));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const statsGroup: Record<string, { logs: any[], highestOdo: number, latestOil: any }> = {};
      snapshot.forEach(doc => {
        const data = doc.data(); const plate = data.plateNumber;
        if (!statsGroup[plate]) statsGroup[plate] = { logs: [], highestOdo: 0, latestOil: null };
        statsGroup[plate].logs.push(data);
        if (data.odometer > statsGroup[plate].highestOdo) statsGroup[plate].highestOdo = data.odometer;
        if (data.type === 'oil' && (!statsGroup[plate].latestOil || data.odometer > statsGroup[plate].latestOil.odometer)) statsGroup[plate].latestOil = data;
      });
      
      const processedStats: Record<string, VehicleStats> = {};
      for (const plate in statsGroup) {
         const group = statsGroup[plate];
         const fuelLogs = group.logs.filter(l => l.type === 'fuel').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
         let kml = '0.0';
         if (fuelLogs.length >= 2) {
           const lastLog = fuelLogs[fuelLogs.length - 1]; const prevLog = fuelLogs.slice().reverse().find(l => l.odometer < lastLog.odometer);
           if (prevLog && lastLog.liters > 0) kml = ((lastLog.odometer - prevLog.odometer) / lastLog.liters).toFixed(1); 
         }
         let remainingOil = 0; let hasOilData = false;
         if (group.latestOil) { hasOilData = true; remainingOil = group.latestOil.oilLimit - (group.highestOdo - group.latestOil.odometer); }
         processedStats[plate] = { kml, highestOdo: group.highestOdo, remainingOil, hasOilData };
      }
      setAllVehicleStats(processedStats);
    });

    const qBanks = query(collection(db, "bank_accounts"), where("userId", "==", userUid));
    const unsubBanks = onSnapshot(qBanks, (snapshot) => {
       const bList: any[] = [];
       snapshot.forEach(doc => bList.push({ id: doc.id, ...doc.data() }));
       bList.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
       setBankAccounts(bList);
    });

    return () => { unsubUser(); unsubTx(); unsubVehicles(); unsubLogs(); unsubBanks(); };
  }, [userUid]);

  useEffect(() => {
    let advice = "";
    const { expense, income, fuel, food, bal } = currentMonthStats;

    if (expense === 0) { advice = "Belum ada pengeluaran yang tercatat bulan ini. Tetap pertahankan kebiasaan hematmu!"; } 
    else if (income > 0 && expense > income) { advice = `🚨 Gawat! Pengeluaranmu bulan ini (${formatRupiah(expense)}) sudah melebihi total pemasukanmu. Segera rem pengeluaran!`; } 
    else if (income > 0 && expense > (income * 0.8)) { advice = `⚠️ Hati-hati! Pengeluaranmu sudah menyentuh 80% dari pemasukan bulan ini. Tahan keinginan belanja non-esensial.`; } 
    else if (bal < 0) { advice = "Gawat! Saldo utamamu minus. Prioritaskan pelunasan tagihan sebelum melakukan pengeluaran lain."; } 
    else if (expense > 0 && (fuel / expense) > 0.25) { advice = `Biaya BBM memakan >${Math.round((fuel/expense)*100)}% dari total pengeluaranmu. Coba kurangi mobilitas yang tidak perlu.`; } 
    else if (expense > 0 && (food / expense) > 0.35) { advice = `Wah, jajan dan makan di luar menguras dompetmu (>${Math.round((food/expense)*100)}% pengeluaran). Sesekali coba bawa bekal yuk!`; } 
    else { advice = `Keuanganmu sehat! Bulan ini kamu baru menghabiskan ${formatRupiah(expense)}. Terus catat transaksimu secara rutin.`; }
    
    setAiAdvice(advice);
  }, [currentMonthStats]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    import('@capacitor/app').then(({ App }) => {
      const handleDeepLink = (url: string) => {
        if (url.includes('autoText=')) {
           try {
              const autoTextRaw = url.split('autoText=')[1];
              if (autoTextRaw) {
                 const autoText = decodeURIComponent(autoTextRaw);
                 
                 const lastProcessed = sessionStorage.getItem('bri9_last_notif');
                 if (lastProcessed === autoText) return; 

                 const originalParts = autoText.split(' | ');
                 const titleTextOriginal = originalParts[0] || "";
                 const bodyTextOriginal = originalParts[1] || autoText;
                 const lowerText = autoText.toLowerCase();

                 const spamKeywords = [
                    'voucher', 'promo', 'diskon', 's.d.', 's/d', 'cashback', 
                    'iphone', 'tebus', 'spesial', 'gratis ongkir', 'flash sale', 
                    'klaim', 'hadiah', '7.7', '8.8', '9.9', '10.10', '11.11', '12.12', 'untukmu'
                 ];
                 const isSpam = spamKeywords.some(keyword => lowerText.includes(keyword));
                 
                 if (isSpam) {
                    console.log("Notifikasi diblokir otomatis karena terdeteksi sebagai SPAM/IKLAN.");
                    return; 
                 }

                 let parsedAmount = '';
                 const amountMatch = lowerText.match(/(?:Rp|IDR)?\s*(\d{1,3}(?:[.,]\d{3})*)/i);
                 if (amountMatch && amountMatch[1]) {
                   const cleanAmount = amountMatch[1].replace(/[.,]/g, ''); 
                   
                   const numericCheck = Number(cleanAmount);
                   if (numericCheck < 1000) return; 

                   parsedAmount = cleanAmount.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                 } else {
                   return; 
                 }

                 sessionStorage.setItem('bri9_last_notif', autoText);

                 let isIncome = false;
                 if (lowerText.includes('terima') || lowerText.includes('masuk') || lowerText.includes('dari ') || lowerText.includes('cashback') || lowerText.includes('refund') || lowerText.includes('top up') || lowerText.includes('ditambahkan')) { isIncome = true; }
                 if (lowerText.includes('transfer ke') || lowerText.includes('bayar') || lowerText.includes('pembayaran') || lowerText.includes('beli') || lowerText.includes('keluar') || lowerText.includes('potongan')) { isIncome = false; }

                 let isMutasi = false; let mutasiDir: 'bank_to_cash' | 'cash_to_bank' = 'bank_to_cash';
                 if (lowerText.includes('tarik tunai') || lowerText.includes('penarikan tunai') || lowerText.includes('withdrawal') || lowerText.includes('tarik dana')) { isMutasi = true; mutasiDir = 'bank_to_cash'; } 
                 else if (lowerText.includes('setor tunai') || lowerText.includes('cash deposit')) { isMutasi = true; mutasiDir = 'cash_to_bank'; }

                 let finalType: 'expense' | 'income' | 'mutasi' = 'expense';
                 if (isMutasi) finalType = 'mutasi'; else if (isIncome) finalType = 'income';

                 const findBankName = (textToScan: string) => {
                     if (textToScan.includes('seabank')) return 'Seabank'; if (textToScan.includes('blu')) return 'Blu BCA';
                     if (textToScan.includes('bca')) return 'BCA'; if (textToScan.includes('livin') || textToScan.includes('mandiri')) return 'Mandiri';
                     if (textToScan.includes('gopay') || textToScan.includes('gojek')) return 'GoPay'; if (textToScan.includes('ovo')) return 'OVO';
                     if (textToScan.includes('shopee')) return 'ShopeePay'; if (textToScan.includes('brimo') || textToScan.includes('bri ')) return 'BRI';
                     if (textToScan.includes('jago')) return 'Bank Jago'; if (/\bdana\b/.test(textToScan)) return 'DANA';
                     return null;
                 };
                 const safeBodyText = lowerText.replace(/dana masuk|dana ditambahkan|dana dari|penambahan dana/g, "uang");
                 const detectedBank = findBankName(titleTextOriginal.toLowerCase()) || findBankName(safeBodyText) || 'Bank';

                 let rawNameText = bodyTextOriginal;
                 rawNameText = rawNameText.replace(/(?:Rp|IDR)?\s*\d{1,3}(?:[.,]\d{3})*(?:,\d{2})?/ig, ''); 
                 rawNameText = rawNameText.replace(/\b\d{2}\/\d{2}\/\d{2,4}\b/g, ''); 
                 rawNameText = rawNameText.replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, ''); 
                 rawNameText = rawNameText.replace(/berhasil|sukses|sebesar|telah|melakukan|transaksi|pembayaran|dana masuk|penambahan dana|ke rekening/ig, '');

                 let extractedName = "";
                 if (rawNameText.toLowerCase().includes('qris')) { extractedName = rawNameText.replace(/.*qris\s*(ke|di)?\s*/i, '').trim(); } 
                 else if (rawNameText.toLowerCase().includes('dari ')) { extractedName = rawNameText.replace(/.*dari\s*/i, '').trim(); } 
                 else if (rawNameText.toLowerCase().includes('ke ')) { extractedName = rawNameText.replace(/.*ke\s*/i, '').trim(); } 
                 else { extractedName = rawNameText.replace(/\s+/g, ' ').replace(/^[.,-]+\s*|\s*[.,-]+$/g, '').trim(); }
                 
                 extractedName = extractedName.replace(/^[.,\-:]+\s*/g, '');
                 if (extractedName.length > 25) extractedName = extractedName.substring(0, 25).trim() + '...';
                 if (!extractedName) extractedName = "Tidak diketahui";

                 setAutoProcessModal({ isOpen: true, bankName: detectedBank });
                 
                 setTimeout(() => {
                    setAutoProcessModal(null);
                    setInlineTx({ type: finalType, amount: parsedAmount, note: '', senderReceiverName: isMutasi ? detectedBank : extractedName, detectedBank, mutasiDirection: mutasiDir });
                    setInlineCategory('');
                 }, 1800);
              }
           } catch (e) { console.log("Gagal membaca link notifikasi", e); }
        }
      };

      App.getLaunchUrl().then((launchUrl) => { if (launchUrl && launchUrl.url) handleDeepLink(launchUrl.url); });
      const listenerPromise = App.addListener('appUrlOpen', (data) => { if (data && data.url) handleDeepLink(data.url); });
      return () => { listenerPromise.then(handle => handle.remove()); };
    });
  }, []);

  const handleInlineSubmit = async () => {
    if (!inlineTx) return;
    const parsedAmount = Number(inlineTx.amount.replace(/\./g, ''));
    if (!parsedAmount || parsedAmount <= 0) return showHud("Masukkan nominal yang valid", "error");
    
    if (inlineTx.type === 'mutasi') {
        setIsInlineSaving(true);
        try {
            const sourceMethod = inlineTx.mutasiDirection === 'bank_to_cash' ? 'Transfer' : 'Cash';
            const destMethod = inlineTx.mutasiDirection === 'bank_to_cash' ? 'Cash' : 'Transfer';
            const noteText = inlineTx.note.trim() || (inlineTx.mutasiDirection === 'bank_to_cash' ? 'Tarik Tunai' : 'Setor Tunai');

            await addDoc(collection(db, "transactions"), { type: 'expense', amount: parsedAmount, category: 'Mutasi', note: noteText, receiptUrl: null, date: new Date().toISOString(), createdAt: serverTimestamp(), userId: auth.currentUser?.uid, paymentMethod: sourceMethod });
            await addDoc(collection(db, "transactions"), { type: 'income', amount: parsedAmount, category: 'Mutasi', note: noteText, receiptUrl: null, date: new Date().toISOString(), createdAt: serverTimestamp(), userId: auth.currentUser?.uid, paymentMethod: destMethod });

            showHud("Mutasi Saldo Berhasil!", "success"); setInlineTx(null);
        } catch (e) { showHud("Gagal menyimpan.", "error"); } finally { setIsInlineSaving(false); }
        return;
    }

    if (!inlineCategory) return showHud("Kategori transaksi wajib dipilih!", "error");
    if (!inlineTx.note.trim()) return showHud("Deskripsi transaksi wajib diisi", "error");

    setIsInlineSaving(true);
    try {
      const extraData = inlineTx.type === 'income' ? { senderName: inlineTx.senderReceiverName } : { receiverName: inlineTx.senderReceiverName };
      await addDoc(collection(db, "transactions"), {
        type: inlineTx.type, amount: parsedAmount, category: inlineCategory, note: inlineTx.note, receiptUrl: null, 
        date: new Date().toISOString(), createdAt: serverTimestamp(), userId: auth.currentUser?.uid, paymentMethod: 'Transfer', ...extraData 
      });
      showHud("Data berhasil disimpan!", "success"); setInlineTx(null); setInlineCategory('');
    } catch (error) { showHud("Gagal menyimpan data.", "error"); } finally { setIsInlineSaving(false); }
  };

  const handleSaveBank = async () => {
     if (!newBank.bankName || !newBank.accountNumber || !newBank.accountName) return showHud("Isi semua data rekening dengan lengkap!", "error");
     setIsSavingBank(true);
     try {
        await addDoc(collection(db, "bank_accounts"), {
           userId: auth.currentUser?.uid,
           bankName: newBank.bankName,
           accountNumber: newBank.accountNumber,
           accountName: newBank.accountName,
           createdAt: serverTimestamp()
        });
        showHud("Rekening berhasil ditambahkan!", "success");
        setShowAddBankModal(false);
        setNewBank({ bankName: '', accountNumber: '', accountName: userName });
     } catch (e) { showHud("Gagal menyimpan rekening", "error"); } finally { setIsSavingBank(false); }
  };

  const handleCopyBank = (bank: any) => {
     const textToCopy = `${bank.bankName} ${bank.accountNumber} a.n. ${bank.accountName}`;
     if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToCopy); showHud("Nomor Rekening Disalin!", "success");
     } else {
        const textArea = document.createElement("textarea"); textArea.value = textToCopy;
        document.body.appendChild(textArea); textArea.focus(); textArea.select();
        try { document.execCommand('copy'); showHud("Nomor Rekening Disalin!", "success"); } catch (err) { showHud("Gagal menyalin", "error"); }
        document.body.removeChild(textArea);
     }
  };

  const formatRupiah = (angka: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
  
  const calculateRank = (wealth: number) => {
    if (wealth < 1000000) return { name: 'Epic', color: 'text-orange-400', border: 'border-orange-500/50', max: 1000000 };
    if (wealth < 5000000) return { name: 'Legend', color: 'text-gray-300', border: 'border-gray-400/50', max: 5000000 };
    if (wealth < 20000000) return { name: 'Mythic', color: 'text-yellow-400', border: 'border-yellow-500/50', max: 20000000 };
    if (wealth < 50000000) return { name: 'Immortal', color: 'text-teal-400', border: 'border-teal-500/50', max: 50000000 };
    return { name: 'Mythic Tycoon', color: 'text-fuchsia-400', border: 'border-fuchsia-500/50', max: wealth * 1.5 }; 
  };

  const totalWealth = savingsBalance + investmentBalance;
  const userRank = calculateRank(totalWealth);
  const expPercentage = Math.min((totalWealth / userRank.max) * 100, 100);

  const getIcon = (cat: string, type: string) => {
    const iconClass = "w-5 h-5 text-gray-300"; let d = "";
    switch (cat) {
      case 'Investment': d = "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"; break;
      case 'Bonus': d = "M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"; break;
      case 'Savings': d = "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"; break;
      case 'Salary': d = "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"; break;
      case 'Allowance': d = "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"; break;
      case 'Food & Drink': d = "M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z"; break;
      case 'Shopping': d = "M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"; break;
      case 'Bills': d = "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 112-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"; break;
      case 'Fuel': case 'Vehicle Maintenance': d = "M13 10V3L4 14h7v7l9-11h-7z"; break;
      case 'Other': d = "M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"; break;
      default: d = type === 'income' ? "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" : "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"; 
    }
    return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} /></svg>;
  };

  const financeCards = [
    { id: 'main', bg: 'bg-[#151515] border-gray-800', title: 'Total Balance', amount: balance, textColor: 'text-white' },
    { id: 'invest', bg: 'bg-gradient-to-br from-blue-900 to-indigo-900 border-blue-500/30', title: 'Investment Portfolio', amount: investmentBalance, textColor: 'text-blue-50', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
    { id: 'bonus', bg: 'bg-gradient-to-br from-fuchsia-900 to-purple-900 border-fuchsia-500/30', title: 'Bonus Balance', amount: bonusBalance, textColor: 'text-fuchsia-50', icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4' },
    { id: 'savings', bg: 'bg-gradient-to-br from-teal-900 to-emerald-900 border-teal-500/30', title: 'Total Savings', amount: savingsBalance, textColor: 'text-teal-50', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' }
  ];

  const savingsGradients = ["from-teal-900 to-emerald-900 border-teal-500/40", "from-blue-900 to-indigo-900 border-blue-500/40", "from-fuchsia-900 to-purple-900 border-fuchsia-500/40", "from-amber-900 to-orange-900 border-amber-500/40"];
  const vehicleGradients = ["from-[#0f2027] via-[#203a43] to-[#2c5364]", "from-[#4a1c40] to-[#fd1d1d]", "from-indigo-900 to-blue-900", "from-orange-900 to-amber-700", "from-emerald-900 to-teal-800", "from-purple-900 to-fuchsia-800"];
  
  const bankGradients = [
     "from-[#1c1c1e] to-[#151515] border-gray-700/50",
     "from-blue-900/40 to-indigo-900/20 border-blue-800/50",
     "from-emerald-900/40 to-teal-900/20 border-emerald-800/50",
     "from-purple-900/40 to-fuchsia-900/20 border-fuchsia-800/50"
  ];

  const systemAlerts: any[] = [];
  if (balance < 0) systemAlerts.push({ title: "⚠️ Saldo Minus", desc: "Saldo utama Anda saat ini berada di bawah nol.", type: "warning" });
  vehicles.forEach(v => {
    const stats = allVehicleStats[v.plate];
    if (stats && stats.hasOilData && stats.remainingOil <= 500) {
      if (stats.remainingOil < 0) systemAlerts.push({ title: "🚨 OLI OVERDUE!", desc: `Gawat! Oli motor ${v.name} (${v.plate}) sudah terlewat ${Math.abs(stats.remainingOil)} KM dari jadwal. Segera ganti sebelum mesin rusak!`, type: "danger" });
      else systemAlerts.push({ title: "⚠️ Persiapan Ganti Oli", desc: `Sedikit lagi waktunya ganti oli untuk ${v.name} (${v.plate}). Sisa jarak aman: ${stats.remainingOil} KM lagi.`, type: "warning" });
    }
  });

  const savingsEntries = Object.entries(savingsGoalsList);

  return (
    <div className="relative min-h-screen bg-black select-none overflow-hidden flex justify-center">
      <AiReminder />
      <main className="w-full max-w-md min-h-screen bg-black text-white font-sans pb-32">
        
        {/* MODAL TAMBAH REKENING */}
        {showAddBankModal && (
          <div className="fixed inset-0 z-[350] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[#1c1c1e] w-full max-w-sm rounded-t-[2.5rem] sm:rounded-[2.5rem] p-7 border border-white/10 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white">Tambah Rekening Baru</h3>
                <button onClick={() => setShowAddBankModal(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              <div className="flex flex-col gap-4">
                <div>
                   <label className="text-xs text-gray-400 ml-1 mb-1.5 block font-medium">Nama Bank / E-Wallet</label>
                   <input type="text" value={newBank.bankName} onChange={(e) => setNewBank({...newBank, bankName: e.target.value})} placeholder="Contoh: BCA / Seabank / GoPay" className="w-full bg-[#262629] text-white p-4 rounded-2xl outline-none text-[14px] border border-transparent focus:border-blue-500/50 transition-colors" />
                </div>
                <div>
                   <label className="text-xs text-gray-400 ml-1 mb-1.5 block font-medium">Nomor Rekening</label>
                   <input type="text" inputMode="numeric" value={newBank.accountNumber} onChange={(e) => setNewBank({...newBank, accountNumber: e.target.value.replace(/\D/g, '')})} placeholder="Contoh: 901379105585" className="w-full bg-[#262629] text-white p-4 rounded-2xl outline-none text-[15px] font-bold border border-transparent focus:border-blue-500/50 transition-colors tracking-widest" />
                </div>
                <div>
                   <label className="text-xs text-gray-400 ml-1 mb-1.5 block font-medium">Atas Nama (a.n.)</label>
                   <input type="text" value={newBank.accountName} onChange={(e) => setNewBank({...newBank, accountName: e.target.value})} placeholder={`Contoh: ${userName}`} className="w-full bg-[#262629] text-white p-4 rounded-2xl outline-none text-[14px] border border-transparent focus:border-blue-500/50 transition-colors uppercase" />
                </div>
                
                <button onClick={handleSaveBank} disabled={isSavingBank} className={`w-full text-white py-4 rounded-2xl font-bold mt-2 flex items-center justify-center transition-all ${isSavingBank ? 'bg-blue-600/70 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.3)]'}`}>
                   {isSavingBank ? "Menyimpan..." : "Simpan Rekening"}
                </button>
              </div>
            </div>
          </div>
        )}

        {autoProcessModal && autoProcessModal.isOpen && (
          <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-[#1c1c1e] p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center justify-center gap-5 w-[260px] animate-in zoom-in-95 duration-300 border border-white/5">
              <div className="w-[72px] h-[72px] bg-[#1d3d25] rounded-full flex items-center justify-center shadow-inner">
                 <svg className="w-8 h-8 text-[#4ade80]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7"/></svg>
              </div>
              <p className="text-white font-medium text-center text-[15px] leading-relaxed tracking-wide">
                Memproses<br/>otomatis dari<br/>
                <span className="font-bold text-white text-base">{autoProcessModal.bankName}</span>...
              </p>
            </div>
          </div>
        )}

        {inlineTx && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-in fade-in duration-300">
            <div className="bg-[#1c1c1e] w-full max-w-sm rounded-[2.5rem] p-6 border border-white/10 shadow-2xl animate-in zoom-in-95 duration-300">
              
              <div className="flex items-center justify-between mb-6">
                 <h2 className="text-xl font-bold tracking-wide">Konfirmasi</h2>
                 <div className="relative">
                   <button onClick={() => setIsInlineTypeOpen(!isInlineTypeOpen)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-transform hover:scale-105 shadow-sm ${inlineTx.type === 'income' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : inlineTx.type === 'mutasi' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                      {inlineTx.type}
                      <svg className={`w-3.5 h-3.5 transition-transform ${isInlineTypeOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                   </button>
                   {isInlineTypeOpen && (
                      <div className="absolute right-0 mt-2 w-36 bg-[#2a2a2d] border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                         <div onClick={() => { setInlineTx({...inlineTx, type: 'expense'}); setInlineCategory(''); setIsInlineTypeOpen(false); }} className="px-4 py-3 text-xs font-bold text-red-400 hover:bg-white/5 cursor-pointer border-b border-white/5 flex items-center justify-between">EXPENSE {inlineTx.type === 'expense' && '✓'}</div>
                         <div onClick={() => { setInlineTx({...inlineTx, type: 'income'}); setInlineCategory(''); setIsInlineTypeOpen(false); }} className="px-4 py-3 text-xs font-bold text-green-400 hover:bg-white/5 cursor-pointer border-b border-white/5 flex items-center justify-between">INCOME {inlineTx.type === 'income' && '✓'}</div>
                         <div onClick={() => { setInlineTx({...inlineTx, type: 'mutasi'}); setIsInlineTypeOpen(false); }} className="px-4 py-3 text-xs font-bold text-amber-400 hover:bg-white/5 cursor-pointer flex items-center justify-between">MUTASI {inlineTx.type === 'mutasi' && '✓'}</div>
                      </div>
                   )}
                 </div>
              </div>
              
              <div className="flex flex-col gap-4">
                 <div>
                    <label className="text-xs text-gray-500 ml-1 mb-1.5 block font-medium">Nominal</label>
                    <div className="flex items-center gap-3 bg-[#262629] rounded-2xl p-4 border border-transparent focus-within:border-gray-500 transition-colors">
                       <span className="text-gray-400 font-semibold text-lg">Rp</span>
                       <input type="text" inputMode="numeric" value={inlineTx.amount} onChange={(e) => {
                          const rawValue = e.target.value.replace(/\D/g, ''); 
                          setInlineTx({...inlineTx, amount: rawValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".")});
                       }} className="bg-transparent text-white text-2xl font-bold w-full outline-none" />
                    </div>
                 </div>

                 {inlineTx.type === 'mutasi' && (
                    <div className="flex bg-[#262629] rounded-2xl p-1 border border-white/5">
                       <button type="button" onClick={() => setInlineTx({...inlineTx, mutasiDirection: 'bank_to_cash'})} className={`flex-1 py-3 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 ${inlineTx.mutasiDirection === 'bank_to_cash' ? 'bg-emerald-500/10 text-emerald-400 shadow-sm border border-emerald-500/20' : 'text-gray-500 hover:text-gray-300'}`}>
                          <span className="text-xl mb-1">🏧</span> Tarik Tunai (Ke Cash)
                       </button>
                       <button type="button" onClick={() => setInlineTx({...inlineTx, mutasiDirection: 'cash_to_bank'})} className={`flex-1 py-3 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 ${inlineTx.mutasiDirection === 'cash_to_bank' ? 'bg-blue-500/10 text-blue-400 shadow-sm border border-blue-500/20' : 'text-gray-500 hover:text-gray-300'}`}>
                          <span className="text-xl mb-1">🏦</span> Setor Tunai (Ke Bank)
                       </button>
                    </div>
                 )}

                 {inlineTx.type !== 'mutasi' && (
                    <div>
                       <label className="text-xs text-gray-500 ml-1 mb-1.5 block font-medium">
                          {inlineTx.type === 'income' ? 'Nama Pengirim' : 'Nama Penerima / Merchant'}
                       </label>
                       <div className="flex items-center gap-3 bg-[#262629]/50 rounded-2xl p-4 border border-white/5">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          <input type="text" value={inlineTx.senderReceiverName} onChange={(e) => setInlineTx({...inlineTx, senderReceiverName: e.target.value})} className="bg-transparent text-white font-medium w-full outline-none" />
                       </div>
                    </div>
                 )}

                 {inlineTx.type !== 'mutasi' && (
                    <div className="relative z-30">
                      <label className="text-xs text-gray-500 ml-1 mb-1.5 block font-medium">Kategori <span className="text-red-500">*</span></label>
                      <button type="button" onClick={() => setIsInlineDropdownOpen(!isInlineDropdownOpen)} className={`w-full bg-[#262629] p-4 rounded-2xl flex justify-between items-center text-[15px] border border-transparent font-medium transition-colors ${inlineCategory ? 'text-white' : 'text-gray-500'}`}>
                        {inlineCategory || 'Wajib Pilih Kategori...'} <svg className={`w-4 h-4 text-gray-400 transition-transform ${isInlineDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      {isInlineDropdownOpen && (
                        <div className="absolute z-40 w-full mt-2 bg-[#2a2a2d] border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto">
                          {(inlineTx.type === 'expense' ? expenseCategories : incomeCategories).map((cat, index) => (
                            <div key={index} onClick={() => { setInlineCategory(cat); setIsInlineDropdownOpen(false); }} className="p-4 text-[14px] font-medium text-gray-200 hover:bg-[#38383c] hover:text-white cursor-pointer transition-colors border-b border-gray-700/50 last:border-0">{cat}</div>
                          ))}
                        </div>
                      )}
                    </div>
                 )}

                 <div>
                    <label className="text-xs text-gray-500 ml-1 mb-1.5 block font-medium">Deskripsi Transaksi <span className="text-red-500">*</span></label>
                    <input type="text" value={inlineTx.note} onChange={(e) => setInlineTx({...inlineTx, note: e.target.value})} placeholder={inlineTx.type === 'mutasi' ? "e.g., Tarik Tunai di Indomaret" : "e.g., Beli Nasi Goreng / Bayar SPP"} className="w-full bg-[#262629] text-white p-4 rounded-2xl outline-none text-[15px] border border-transparent focus:border-gray-500 transition-colors" />
                 </div>

                 <div className="flex gap-3 mt-3">
                    <button onClick={() => { setInlineTx(null); setInlineCategory(''); setIsInlineDropdownOpen(false); }} className="flex-1 bg-[#262629] text-gray-300 py-3.5 rounded-2xl font-medium hover:bg-gray-800 transition-colors">Batal</button>
                    <button onClick={handleInlineSubmit} disabled={isInlineSaving} className={`flex-[1.5] text-white py-3.5 rounded-2xl font-bold flex items-center justify-center transition-all ${isInlineSaving ? 'bg-blue-600/70 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.3)]'}`}>
                       {isInlineSaving ? <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : `Simpan Data`}
                    </button>
                 </div>
                 <p className="text-[10px] text-gray-500 text-center mt-1">Sistem otomatis merekam ini sebagai saldo Transfer.</p>
              </div>
            </div>
          </div>
        )}

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

        <header className="flex justify-between items-center px-6 pt-10 mb-8 relative z-50">
          <div className="flex items-center gap-4 w-full">
            <div className={`w-14 h-14 rounded-full overflow-hidden border-2 relative shrink-0 ${userRank.border} shadow-[0_0_15px_rgba(255,255,255,0.1)]`}>
              <img src={profilePic || `https://ui-avatars.com/api/?name=${userName}&background=1c1c1e&color=fff`} className="w-full h-full object-cover" alt="Profile" />
            </div>
            
            <div className="flex-1 flex flex-col justify-center min-w-0 pr-2">
              <div className="flex justify-between items-end mb-1">
                 <h1 className="text-sm font-semibold tracking-wide capitalize truncate pr-2">{userName}</h1>
                 <span className={`text-[10px] font-bold ${userRank.color} uppercase tracking-wider`}>{userRank.name}</span>
              </div>
              <div className="w-full bg-[#262629] rounded-full h-1.5 overflow-hidden border border-white/5 relative">
                 <div className={`h-full bg-gradient-to-r from-blue-500 to-teal-400 transition-all duration-1000 ease-out`} style={{ width: `${expPercentage}%` }}></div>
              </div>
              <p className="text-[9px] text-gray-500 mt-1 text-right">Next Rank: {formatRupiah(userRank.max)}</p>
            </div>
            
            <div className="relative shrink-0 ml-1">
              <button onClick={() => setShowNotifications(!showNotifications)} className="hover:text-blue-400 transition-colors relative">
                 <svg className="w-6 h-6 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                 {systemAlerts.length > 0 && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-black"></span></span>}
              </button>
              {showNotifications && (
                 <div className="absolute right-0 mt-4 w-72 bg-[#1c1c1e] border border-gray-700 rounded-2xl shadow-2xl p-4 animate-in fade-in z-50">
                    <div className="flex justify-between items-center mb-4"><h4 className="text-sm font-semibold text-white">Notifications</h4><span className="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">{systemAlerts.length} New</span></div>
                    <div className="flex flex-col gap-3">
                      {systemAlerts.length > 0 ? systemAlerts.map((alert, i) => (
                         <div key={i} className="flex gap-3 items-start border-b border-white/5 pb-3 last:border-0 last:pb-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${alert.type === 'danger' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg></div>
                            <div><p className="text-sm font-medium text-white mb-0.5">{alert.title}</p><p className="text-[11px] text-gray-400 leading-relaxed">{alert.desc}</p></div>
                         </div>
                      )) : <p className="text-xs text-gray-500 text-center py-4">Sistem aman. Tidak ada peringatan baru.</p>}
                    </div>
                 </div>
              )}
            </div>
          </div>
        </header>

        {/* AI ADVISOR */}
        <section className="px-6 mb-8 relative z-10 flex items-center justify-between gap-3">
          <div className="flex-1 flex items-start gap-3 bg-white/5 border border-white/5 p-4 rounded-2xl">
            <span className="text-lg animate-pulse drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]">✨</span>
            <p className="text-[13px] text-gray-300 leading-relaxed font-medium">
              <strong className="text-blue-400 font-semibold mr-1">AI Insight:</strong>
              {aiAdvice}
            </p>
          </div>
          <Link href="/journal" className="shrink-0 bg-blue-600/20 border border-blue-500/30 text-blue-400 px-3 py-4 rounded-2xl font-bold text-xs hover:bg-blue-600/40 flex flex-col items-center justify-center gap-1 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
            Jurnal
          </Link>
        </section>

        {/* FINANCIAL CARDS */}
        <section className="pl-6 mb-6 mt-4">
          <div className="flex gap-4 overflow-x-auto pr-6 snap-x snap-mandatory hide-scrollbar pb-4">
            {financeCards.map((card, index) => {
              const isActive = index === activeFinanceCard;
              return (
                <div key={card.id} onClick={() => setActiveFinanceCard(index)} className={`w-[82vw] sm:w-[320px] snap-center rounded-[2rem] p-5 shadow-xl border flex justify-between items-center shrink-0 ${card.bg}`}>
                  <div className="flex-1 min-w-0 pr-2">
                    <p className={`text-[13px] mb-1 flex items-center gap-1.5 ${isActive ? 'text-gray-300' : 'text-gray-400'} truncate`}>{card.icon && <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} /></svg>}<span>{card.title}</span></p>
                    <h2 className={`text-[22px] sm:text-[26px] font-bold tracking-tight leading-tight ${card.textColor} break-words mt-1`}>{formatRupiah(card.amount)}</h2>
                    {card.id === 'main' && (
                       <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                          <span className="text-[9px] sm:text-[10px] bg-white/10 px-2 py-1 rounded-md text-gray-300 font-medium tracking-wide">💵 Cash: {formatRupiah(cashBalance)}</span>
                          <span className="text-[9px] sm:text-[10px] bg-white/10 px-2 py-1 rounded-md text-gray-300 font-medium tracking-wide">💳 Saldo: {formatRupiah(transferBalance)}</span>
                       </div>
                    )}
                  </div>
                  <Link href="/add" className="flex flex-col items-center justify-center shrink-0 ml-1 pointer-events-auto"><div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white text-black flex items-center justify-center text-2xl font-medium shadow-lg hover:scale-105 transition-transform">+</div></Link>
                </div>
              );
            })}
          </div>
        </section>

        {/* REKENING PRIBADI STACKED CARDS */}
        <section className="px-6 mb-10 relative z-10">
           <div className="flex justify-between items-center mb-5">
             <h3 className="text-lg font-medium text-white/90">Rekening Pribadi</h3>
             <button onClick={() => setShowAddBankModal(true)} className="text-xs text-blue-400 hover:text-white transition-colors font-medium flex items-center gap-1">
               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg> Tambah Baru
             </button>
           </div>
           
           {bankAccounts.length === 0 ? (
              <div className="w-full bg-[#151515] rounded-[1.5rem] p-6 border border-white/5 shadow-md flex items-center justify-center gap-3 text-gray-500 text-[13px]">
                 <svg className="w-5 h-5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                 Belum ada rekening tersimpan.
              </div>
           ) : (
              <div className="relative w-full min-h-[135px] mt-2">
                {bankAccounts.map((bank, index) => {
                  const offset = (index - activeBankCard + bankAccounts.length) % bankAccounts.length;
                  const scale = 1 - (offset * 0.05); const translateY = offset * 22; const zIndex = 20 - offset; const brightness = 1 - (offset * 0.15); 

                  return (
                     <div 
                       key={bank.id} 
                       onClick={() => setActiveBankCard(index)}
                       className={`absolute top-0 left-0 right-0 h-[115px] w-full bg-[#151515] bg-gradient-to-br ${bankGradients[index % bankGradients.length]} rounded-[1.5rem] p-5 shadow-2xl border border-white/10 cursor-pointer transition-all duration-500 ease-out flex justify-between items-center overflow-hidden`} 
                       style={{ zIndex, transform: `scale(${scale}) translateY(${translateY}px)`, filter: `brightness(${brightness})` }}
                     >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                        <div className="flex flex-col min-w-0 flex-1 pr-4 relative z-10">
                           <p className="text-[12px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">{bank.bankName}</p>
                           <p className="text-[20px] font-black text-white tracking-widest truncate mb-0.5">{bank.accountNumber}</p>
                           <p className="text-[10px] text-gray-500 font-medium truncate uppercase">A.N. {bank.accountName}</p>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleCopyBank(bank); }} 
                          className="w-11 h-11 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 hover:bg-blue-500 hover:text-white transition-colors relative z-10 border border-blue-500/20 active:scale-95"
                        >
                           <svg className="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </button>
                     </div>
                  );
                })}
              </div>
           )}
        </section>

        {/* QUICK ACTION BUTTONS */}
        <section className="px-6 mb-10 relative z-10">
          <div className="flex gap-3">
            <Link href="/add-vehicle" className="flex-1 bg-[#1a0f14] rounded-[1rem] py-3.5 px-4 border border-red-500/20 shadow-lg flex items-center justify-center gap-2.5 hover:bg-[#24151c] transition-colors relative overflow-hidden">
               <div className="absolute top-0 right-0 w-8 h-8 bg-red-500/10 rounded-full blur-md -mr-4 -mt-4"></div>
               <svg className="w-5 h-5 text-red-500 relative z-10 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
               <span className="text-[13px] font-bold text-white tracking-wide relative z-10 truncate">Bore Up</span>
            </Link>
            <Link href="/smart-odo" className="flex-1 bg-[#0f172a] rounded-[1rem] py-3.5 px-4 border border-blue-500/20 shadow-lg flex items-center justify-center gap-2.5 hover:bg-[#16223f] transition-colors relative overflow-hidden">
               <div className="absolute top-0 right-0 w-8 h-8 bg-blue-500/10 rounded-full blur-md -mr-4 -mt-4"></div>
               <svg className="w-5 h-5 text-blue-500 relative z-10 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
               <span className="text-[13px] font-bold text-white tracking-wide relative z-10 truncate">Smart Odo</span>
            </Link>
          </div>
        </section>

        {/* SAVINGS TARGETS */}
        {savingsEntries.length > 0 && (
          <section className="px-6 mb-10">
            <h3 className="text-lg font-medium text-white/90 mb-4 flex justify-between items-center"><span>Savings Targets</span><span className="text-[11px] font-bold bg-white/10 text-gray-300 px-3 py-1 rounded-full">{savingsEntries.length} Goals</span></h3>
            <div className="relative w-full min-h-[170px] mt-2">
              {savingsEntries.map(([goalName, data], index) => {
                const offset = (index - activeSavingsIndex + savingsEntries.length) % savingsEntries.length;
                const scale = 1 - (offset * 0.05); const translateY = offset * 22; const zIndex = 20 - offset; const brightness = 1 - (offset * 0.15); 
                const percentage = Math.min((data.current / data.target) * 100, 100);
                return (
                  <div key={goalName} onClick={() => setActiveSavingsIndex(index)} className={`absolute top-0 left-0 right-0 h-[125px] w-full bg-gradient-to-br ${savingsGradients[index % savingsGradients.length]} rounded-[1.5rem] p-5 border shadow-2xl cursor-pointer transition-all duration-500 ease-out flex flex-col justify-center`} style={{ zIndex, transform: `scale(${scale}) translateY(${translateY}px)`, filter: `brightness(${brightness})` }}>
                    <div className="flex justify-between items-end mb-3"><p className="text-[15px] font-bold text-white truncate pr-2 capitalize tracking-wide">{goalName}</p><p className="text-sm text-white font-bold whitespace-nowrap">{percentage.toFixed(0)}%</p></div>
                    <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden mb-2"><div className="bg-white h-2 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(255,255,255,0.5)]" style={{ width: `${percentage}%` }}></div></div>
                    <p className="text-[11px] text-white/80 text-right font-medium tracking-wide">{formatRupiah(data.current)} <span className="opacity-50">/ {formatRupiah(data.target)}</span></p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* YOUR VEHICLES */}
        <section className="px-6 mb-10">
          <div className="flex justify-between items-center mb-5"><h3 className="text-lg font-medium text-white/90">Your vehicles</h3><Link href="/add-vehicle" className="text-xs text-blue-400 hover:text-white transition-colors font-medium">+ New vehicle</Link></div>
          {vehicles.length === 0 ? (
             <div className="w-full h-[170px] bg-[#151515] rounded-3xl p-6 flex flex-col items-center justify-center text-gray-500 text-sm border border-white/5"><svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Belum ada kendaraan.</div>
          ) : (
            <div className="relative w-full min-h-[210px] mt-2">
              {vehicles.map((v, index) => {
                const offset = (index - activeVehicleCard + vehicles.length) % vehicles.length;
                const stats = allVehicleStats[v.plate] || { kml: '0.0', highestOdo: 0, remainingOil: 0, hasOilData: false };
                const scale = 1 - (offset * 0.05); const translateY = offset * 22; const zIndex = 20 - offset; const brightness = 1 - (offset * 0.15); 
                return (
                  <div key={v.plate} onClick={() => setActiveVehicleCard(index)} className={`absolute top-0 left-0 right-0 h-[160px] w-full bg-gradient-to-br ${vehicleGradients[index % vehicleGradients.length]} rounded-[1.5rem] p-5 shadow-2xl border border-white/10 cursor-pointer transition-all duration-500 ease-out flex flex-col justify-between`} style={{ zIndex, transform: `scale(${scale}) translateY(${translateY}px)`, filter: `brightness(${brightness})` }}>
                     <div className="flex justify-between items-start">
                        <div><p className="font-semibold text-white/90 text-sm">{v.name}</p><p className="text-[10px] text-white/60">{stats.highestOdo} KM</p></div>
                        <Link href={`/vehicle?plate=${v.plate}`} className="bg-white/10 px-3 py-1.5 rounded-full text-[10px] font-medium text-white border border-white/10 hover:bg-white/20 transition-colors z-30 relative">+ Update</Link>
                     </div>
                     <div>
                        <p className="text-2xl font-bold text-white tracking-widest mb-1.5">{v.plate}</p>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] bg-black/20 px-2 py-1 rounded-md text-white/80 flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>{stats.kml} km/L</span>
                          <span className={`text-[11px] bg-black/20 px-2 py-1 rounded-md text-white/80 flex items-center gap-1 ${stats.hasOilData && stats.remainingOil <= 500 ? 'text-red-400 font-bold' : ''}`}><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>{stats.hasOilData ? `${stats.remainingOil} km left` : 'No Data'}</span>
                        </div>
                     </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="px-6">
           <div className="flex justify-between items-center mb-5"><h3 className="text-lg font-medium text-white/90">Recent transactions</h3><Link href="/history" className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">See all</Link></div>
           <div className="flex flex-col gap-3">
              {transactions.slice(0, 5).map((tx) => {
                const txDate = new Date(tx.date);
                const timeString = txDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                const dateString = txDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                let titleText = tx.note || (tx.type === 'income' ? 'Dana Masuk' : 'Pengeluaran');
                let subText = tx.category;
                if (tx.senderName) subText = `Dari: ${tx.senderName} • ${tx.category}`;
                if (tx.receiverName) subText = `Ke: ${tx.receiverName} • ${tx.category}`;
                if (tx.investmentPlatform) subText = `${subText} (${tx.investmentPlatform})`;
                subText = `${subText} • ${tx.paymentMethod === 'Cash' ? 'Cash' : 'Saldo'}`;

                return (
                  <div key={tx.id} className="flex justify-between items-center bg-[#151515] p-4 rounded-[1.25rem] border border-white/5 shadow-md hover:bg-[#1a1a1c] transition-colors">
                     <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-11 h-11 rounded-full bg-[#262629] border border-white/10 flex items-center justify-center shrink-0">
                           {getIcon(tx.category, tx.type)}
                        </div>
                        <div className="flex flex-col min-w-0 pr-2">
                           <p className="font-medium text-[15px] text-white capitalize truncate">{titleText}</p>
                           <p className="text-[11px] text-gray-500 truncate mt-0.5">{subText}</p>
                        </div>
                     </div>
                     <div className="flex flex-col items-end shrink-0 pl-2">
                        {/* === UI TOMBOL HAPUS DITAMBAHKAN DI SINI === */}
                        <div className="flex items-center gap-2.5">
                           <button onClick={() => handleDeleteTransaction(tx.id)} className="w-6 h-6 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors" title="Hapus Transaksi">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                           </button>
                           <p className={`font-bold text-[15px] tracking-wide ${tx.type === 'income' ? 'text-[#00e676]' : 'text-[#ff5252]'}`}>
                              {tx.type === 'expense' ? '-' : '+'}{formatRupiah(tx.amount)}
                           </p>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-1">{dateString} {timeString}</p>
                     </div>
                  </div>
                );
              })}
           </div>
        </section>

        <Navbar activeMenu="home" />
        <style jsx global>{`.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
      </main>
    </div>
  );
}