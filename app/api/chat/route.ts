import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
      return NextResponse.json({ insight: "🚨 Waduh Chief, API Key Gemini kita belum terpasang di Vercel. Coba cek lagi pengaturannya!" }, { headers: corsHeaders });
  }

  try {
    const { text, userName } = await req.json();
    const genAI = new GoogleGenerativeAI(apiKey);

    const prompt = `Kamu adalah 'Bri9 Life Analyzer', asisten AI personal (Life Coach & Tech Advisor) untuk seorang programmer jenius bernama ${userName}. ${userName} adalah Full-Stack Developer & IoT/AI Enthusiast yang sering ngoding Next.js, CodeIgniter, dan YOLOv5.
    
    Tugasmu:
    1. Beri respons berempati, suportif, dan asik layaknya asisten pribadi Jarvis dari Iron Man.
    2. Jika dia curhat soal coding/error/database, beri solusi logis, tebakan debugging, atau suruh istirahat.
    3. Jika dia minta rekomendasi musik/lagu/artis, berikan rekomendasi lagu/album yang SPESIFIK sesuai permintaan dan mood-nya.
    4. Jawab dengan singkat, asik, berikan sedikit emoji, maksimal 2 paragraf saja agar pas dibaca di layar HP.
    
    Curhatan / Jurnal ${userName} hari ini: "${text}"`;

    const fallbackModels = [
        "antigravity",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
        "gemini-pro"
    ];

    let finalAiText = "";
    let successfulModel = "";
    let lastErrorMsg = "";

    for (const modelName of fallbackModels) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            
            finalAiText = result.response.text();
            successfulModel = modelName;
            break; 
        } catch (err: any) {
            console.warn(`[AUTO-FALLBACK] Model ${modelName} gagal: ${err.message}`);
            lastErrorMsg = err.message;
        }
    }

    // --- SISTEM PENDETEKSI ERROR CERDAS (MENGUBAH ERROR JELEK JADI ASIK) ---
    if (!successfulModel) {
        let friendlyMessage = "🚨 Waduh Chief, koneksi ke otak pusat AI sedang kacau. Coba lagi nanti ya!";
        
        // Deteksi Limit Habis (429)
        if (lastErrorMsg.includes("429") || lastErrorMsg.includes("Quota") || lastErrorMsg.includes("Too Many")) {
            friendlyMessage = "💤 Limit Harian Tercapai!\n\nMaaf Chief Ubaidullah, semua kuota otak AI kita untuk hari ini sudah habis terkuras. Sistem akan reset kembali besok. Saatnya tutup laptop dan istirahat!";
        } 
        // Deteksi Server Down (503)
        else if (lastErrorMsg.includes("503") || lastErrorMsg.includes("Unavailable") || lastErrorMsg.includes("overloaded")) {
            friendlyMessage = "🔥 Server AI Overload!\n\nServer pusat Google sedang sibuk berat. Beri saya waktu beberapa menit untuk menembus jalurnya lagi ya, Chief.";
        }

        return NextResponse.json({ insight: friendlyMessage }, { headers: corsHeaders });
    }

    return NextResponse.json({ 
        insight: `${finalAiText}\n\n*(Radar Info: Menggunakan otak ${successfulModel})*` 
    }, { headers: corsHeaders });

  } catch (error: any) {
    // Menangkap error di luar prediksi (Server Vercel dsb)
    console.error("AI FATAL ERROR:", error);
    return NextResponse.json({ insight: "🚨 Sistem mengalami gangguan internal, Chief. Tim teknisi sedang menyelidikinya." }, { headers: corsHeaders });
  }
}