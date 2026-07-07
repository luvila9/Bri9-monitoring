"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      // 1. Daftarkan user baru
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // 2. Kirim email verifikasi
      await sendEmailVerification(userCredential.user);
      
      // Simpan nama ke memori lokal
      localStorage.setItem('bri9_username', name);

      // 3. Tampilkan pesan sukses dan arahkan ke login
      setSuccessMsg("Akun berhasil dibuat! Silakan cek Kotak Masuk/Spam email Anda untuk link verifikasi.");
      
      // Tunggu 3 detik agar user bisa membaca pesan, lalu pindah ke halaman login
      setTimeout(() => {
        router.push('/login');
      }, 3000);

    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        setErrorMsg("Email sudah terdaftar. Silakan login.");
      } else if (error.code === 'auth/weak-password') {
        setErrorMsg("Password terlalu lemah (minimal 6 karakter).");
      } else {
        setErrorMsg("Gagal mendaftar. Pastikan format email benar.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white font-sans flex flex-col justify-center px-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl -ml-20 -mt-20 pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-sm mx-auto flex flex-col pt-10 pb-10">
        <Link href="/login" className="mb-8 self-start bg-[#1c1c1e] p-3 rounded-full border border-white/5 hover:bg-gray-800 transition">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>

        <h1 className="text-3xl font-bold tracking-tight mb-2">Create Account</h1>
        <p className="text-sm text-gray-400 mb-10">Join Bri9 monitoring today.</p>

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <div className="bg-[#151515] rounded-2xl p-2 border border-white/5">
            <input 
              type="text" 
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-transparent text-white px-4 py-3 outline-none text-sm placeholder-gray-500"
            />
          </div>

          <div className="bg-[#151515] rounded-2xl p-2 border border-white/5">
            <input 
              type="email" 
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-transparent text-white px-4 py-3 outline-none text-sm placeholder-gray-500"
            />
          </div>
          
          <div className="bg-[#151515] rounded-2xl p-2 border border-white/5">
            <input 
              type="password" 
              placeholder="Password (min. 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-transparent text-white px-4 py-3 outline-none text-sm placeholder-gray-500"
            />
          </div>

          {errorMsg && <p className="text-xs text-red-400 text-center font-medium bg-red-500/10 py-2 rounded-lg">{errorMsg}</p>}
          {successMsg && <p className="text-xs text-green-400 text-center font-medium bg-green-500/10 py-2 rounded-lg">{successMsg}</p>}

          <button 
            type="submit" 
            disabled={isLoading}
            className={`w-full bg-blue-600 text-white font-semibold text-[15px] py-4 rounded-full mt-4 transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] flex items-center justify-center ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.02]'}`}
          >
            {isLoading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center mt-8">
          By signing up, you agree to our Terms and Privacy Policy.
        </p>
      </div>
    </main>
  );
}