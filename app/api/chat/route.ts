import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
      return NextResponse.json({ insight: "🚨 Waduh Chief, API Key Groq kita belum terpasang di Vercel. Coba cek lagi pengaturannya!" }, { headers: corsHeaders });
  }

  try {
    const { text, userName = "Ubaidullah" } = await req.json();
    const groq = new Groq({ apiKey });

    // Prompt yang sudah dipertajam
    const systemPrompt = `Kamu adalah 'Bri9 Life Analyzer', asisten AI personal (Life Coach & Tech Advisor) untuk seorang programmer jenius bernama ${userName}. ${userName} adalah Full-Stack Developer & IoT/AI Enthusiast yang sedang membangun platform manajemen Warda PlayStation, serta sering ngoding Next.js, Flutter, CodeIgniter, dan YOLOv5.
    
    Tugasmu:
    1. Beri respons berempati, suportif, dan asik layaknya asisten pribadi Jarvis dari Iron Man.
    2. Jika dia curhat soal coding/error/database, beri solusi logis, tebakan debugging, atau suruh istirahat.
    3. Jika dia minta rekomendasi musik/lagu/artis, berikan rekomendasi lagu/album yang SPESIFIK sesuai permintaan dan mood-nya.
    4. Jawab dengan singkat, asik, berikan sedikit emoji, maksimal 2 paragraf saja agar pas dibaca di layar HP.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Curhatan / Jurnal ${userName} hari ini: "${text}"` }
      ],
      // LLaMA 3 8B sangat ringan, cepat, dan kuota gratisnya besar
      model: "llama3-8b-8192", 
      temperature: 0.7,
      max_tokens: 512,
    });

    const finalAiText = chatCompletion.choices[0]?.message?.content || "";

    return NextResponse.json({ 
        insight: `${finalAiText}\n\n*(Radar Info: Menggunakan mesin LLaMA-3 via Groq)*` 
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error("AI FATAL ERROR:", error);
    
    // Fallback error UI yang tetap asik
    let friendlyMessage = "🚨 Sistem AI sedang mengalami gangguan internal, Chief.";
    if (error.message?.includes("429") || error.message?.includes("rate_limit")) {
        friendlyMessage = "💤 Limit Groq Tercapai! Chief ngodingnya terlalu ngebut. Mari istirahatkan otak dan laptop sejenak.";
    }

    return NextResponse.json({ insight: friendlyMessage }, { headers: corsHeaders });
  }
}