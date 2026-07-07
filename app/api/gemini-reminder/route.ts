import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Variabel Konfigurasi Pintu Akses (CORS) untuk APK Android
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// WAJIB: Menangkap sinyal "Preflight" dari HP Android
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
      return NextResponse.json({ message: "Jangan lupa isi jurnalmu hari ini ya, Chief! 🤖" }, { headers: corsHeaders });
  }

  try {
    const { userName } = await req.json();

    // 1. Taktik Radar (Sama seperti sebelumnya)
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listRes.json();
    const validModels = listData.models
        .filter((m: any) => m.supportedGenerationMethods.includes('generateContent') && m.name.includes('gemini'))
        .map((m: any) => m.name.replace('models/', ''));

    const activeModelName = validModels.length > 0 ? validModels[0] : 'gemini-1.5-flash';
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: activeModelName });

    // 2. PROMPT KHUSUS NOTIFIKASI
    const prompt = `Buatkan 1 kalimat notifikasi pendek (maksimal 15 kata) bergaya Jarvis dari Iron Man yang asik dan sedikit menyindir. Tujuannya untuk mengingatkan programmer bernama ${userName} bahwa dia belum mencatat keseharian / curhat coding sama sekali hari ini. Gunakan 1 emoji saja di akhir.`;

    const result = await model.generateContent(prompt);
    let aiText = result.response.text().trim();
    
    // Hapus tanda bintang markdown jika ada
    aiText = aiText.replace(/\*/g, '');

    return NextResponse.json({ message: aiText }, { headers: corsHeaders });

  } catch (error) {
    return NextResponse.json({ message: "Sistem mendeteksi kamu belum mengisi jurnal hari ini. Yuk isi sekarang! 🤖" }, { headers: corsHeaders });
  }
}