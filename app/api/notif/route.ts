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

  // Fallback bawaan jika API Key mati
  if (!apiKey) {
      return NextResponse.json({ message: "Jangan lupa isi jurnalmu hari ini ya, Chief! 🤖" }, { headers: corsHeaders });
  }

  try {
    const { userName = "Ubaidullah" } = await req.json();
    const groq = new Groq({ apiKey });

    const prompt = `Buatkan 1 kalimat notifikasi pendek (maksimal 15 kata) bergaya Jarvis dari Iron Man untuk mengingatkan ${userName} agar mengisi jurnal harian coding-nya hari ini. Singkat, asik, dan gunakan 1 emoji.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-8b-8192", // Model ringan dan super cepat
      temperature: 0.8,
      max_tokens: 50,
    });

    // Membersihkan tanda kutip yang sering dibawa oleh AI
    const aiText = chatCompletion.choices[0]?.message?.content?.replace(/["']/g, "").trim() || "Waktunya update jurnal, Chief! 🚀";

    return NextResponse.json({ message: aiText }, { headers: corsHeaders });

  } catch (error) {
    console.error("GROQ NOTIF ERROR:", error);
    // Jika server Groq down, kembalikan pesan statis ini agar aplikasi tidak crash
    return NextResponse.json({ message: "Jangan lupa isi jurnalmu hari ini ya, Chief! 🤖" }, { headers: corsHeaders });
  }
}