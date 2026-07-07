import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Teknik Bunglon: 
  // Jika Vercel (ada env VERCEL), jangan gunakan output export.
  // Jika lokal/build biasa, tetap gunakan output export untuk Android.
  output: process.env.VERCEL ? undefined : 'export',
  
  images: {
    unoptimized: true,
  },
};

export default nextConfig;