"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    
    try {
      // 1. Coba login
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // 2. Cek apakah email sudah diverifikasi
      if (!userCredential.user.emailVerified) {
        // Jika belum, keluarkan (sign out) paksa dan tampilkan error
        await signOut(auth);
        setErrorMsg("Email belum diverifikasi. Silakan cek Kotak Masuk atau Spam email Anda untuk mengaktifkan akun.");
        setIsLoading(false);
        return;
      }

      // 3. Jika sudah diverifikasi, arahkan ke Dashboard
      router.push('/'); 
      
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        setErrorMsg("Email atau password salah. Silakan coba lagi.");
      } else if (error.code === 'auth/too-many-requests') {
        setErrorMsg("Terlalu banyak percobaan gagal. Coba lagi nanti.");
      } else {
        setErrorMsg("Gagal masuk. Periksa koneksi Anda.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white font-sans flex flex-col justify-center px-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-fuchsia-600/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-sm mx-auto">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-[#1c1c1e] rounded-3xl border border-white/10 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.2)] mb-4">
            <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tighter">
              Bri9
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-wide">Welcome Back</h1>
          <p className="text-sm text-gray-400 mt-1">Sign in to monitor your assets.</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
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
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-transparent text-white px-4 py-3 outline-none text-sm placeholder-gray-500"
            />
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl mt-1">
              <p className="text-[11px] leading-relaxed text-red-400 text-center font-medium">{errorMsg}</p>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading}
            className={`w-full bg-white text-black font-semibold text-[15px] py-4 rounded-full mt-2 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] flex items-center justify-center ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.02]'}`}
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center mt-8">
          Don't have an account? <Link href="/register" className="text-white font-medium hover:underline">Sign up</Link>
        </p>
      </div>
    </main>
  );
}