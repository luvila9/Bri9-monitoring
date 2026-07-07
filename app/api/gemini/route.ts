import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
      return NextResponse.json({ insight: "🚨 ERROR SISTEM: File .env.local tidak terbaca!" });
  }

  try {
    const { text, userName } = await req.json();

    // 1. TAKTIK RADAR: Meminta daftar AI yang aktif langsung dari server Google hari ini
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listRes.json();

    if (listData.error) {
        return NextResponse.json({ insight: `🚨 API KEY DITOLAK:\n${listData.error.message}` });
    }

    // 2. FILTER: Cari AI yang bisa merangkai kata (generateContent) dan bernama "gemini"
    const validModels = listData.models
        .filter((m: any) => m.supportedGenerationMethods.includes('generateContent') && m.name.includes('gemini'))
        .map((m: any) => m.name.replace('models/', ''));

    if (validModels.length === 0) {
        return NextResponse.json({ insight: "🚨 ERROR GOOGLE: Kunci valid, tapi Google belum memberikan akses model Gemini apa pun ke akun ini." });
    }

    // 3. AUTO-SELECT: Gunakan AI pertama yang berhasil ditangkap oleh radar
    const activeModelName = validModels[0]; 
    
    // Mulai panggil AI yang sudah terkonfirmasi ada
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: activeModelName });

    const prompt = `Kamu adalah 'Bri9 Life Analyzer', asisten AI personal (Life Coach & Tech Advisor) untuk seorang programmer jenius bernama ${userName}. ${userName} adalah Full-Stack Developer & IoT/AI Enthusiast yang sering ngoding Next.js, CodeIgniter, dan YOLOv5.
    
    Tugasmu:
    1. Beri respons berempati, suportif, dan asik layaknya asisten pribadi Jarvis dari Iron Man.
    2. Jika dia curhat soal coding/error/database, beri solusi logis, tebakan debugging, atau suruh istirahat.
    3. Jika dia minta rekomendasi musik/lagu/artis, berikan rekomendasi lagu/album yang SPESIFIK sesuai permintaan dan mood-nya.
    4. Jawab dengan singkat, asik, berikan sedikit emoji, maksimal 2 paragraf saja agar pas dibaca di layar HP.
    
    Curhatan / Jurnal ${userName} hari ini: "${text}"`;

    const result = await model.generateContent(prompt);
    const aiText = result.response.text();

    // Memberikan balasan AI sekaligus membocorkan nama model yang berhasil dipakai
    return NextResponse.json({ insight: `${aiText}\n\n*(Radar Info: Menggunakan otak ${activeModelName})*` });

  } catch (error: any) {
    console.error("AI FATAL ERROR:", error);
    return NextResponse.json({ insight: `🚨 FATAL ERROR SAAT GENERATE:\n${error.message}` });
  }
}