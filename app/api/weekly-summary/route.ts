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
      return NextResponse.json({ 
          summary: "🚨 Waduh Chief, API Key Groq kita belum terpasang. Cek Environment Variables!" 
      }, { headers: corsHeaders });
  }

  try {
    const { journals, userName = "Ubaidullah" } = await req.json();

    if (!journals || journals.length === 0) {
        return NextResponse.json({ 
            summary: "📝 Belum ada catatan jurnal minggu ini untuk dianalisis, Chief. Yuk mulai nulis!" 
        }, { headers: corsHeaders });
    }

    const groq = new Groq({ apiKey });

    const systemPrompt = `Kamu adalah 'Bri9 Life Analyzer', analis psikologi dan asisten produktivitas pribadi untuk ${userName}. 
    
    Tugasmu:
    Baca seluruh catatan jurnal harian berikut yang ditulis oleh ${userName} selama seminggu terakhir ini. Analisis pola pikirnya, tingkat stresnya, dan antusiasmenya.
    
    Berikan rangkuman mingguan dengan struktur berikut:
    1. 🧠 Kondisi Mental & Fokus: (Bagaimana mood dan fokus utamanya minggu ini?)
    2. 🏆 Pencapaian Terbesar: (Apa hal terbaik atau rintangan terberat yang berhasil dia lewati?)
    3. 💡 Saran Jarvis: (Berikan 1 kalimat motivasi/saran teknis agar minggu depan lebih baik).
    
    Jawab dengan bahasa yang asik, suportif, profesional ala asisten AI pribadi. Gunakan emoji secukupnya dan pastikan formatnya rapi (maksimal 3-4 paragraf).`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Berikut adalah kumpulan jurnal ${userName} selama 7 hari terakhir:\n"""\n${journals}\n"""` }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 1024,
    });

    const aiSummary = chatCompletion.choices[0]?.message?.content || "Gagal memproses rangkuman.";

    return NextResponse.json({ summary: aiSummary }, { headers: corsHeaders });

  } catch (error: any) {
    console.error("GROQ WEEKLY SUMMARY ERROR:", error);
    
    let friendlyMessage = "🚨 Waduh Chief, gagal menganalisis rangkuman mingguan karena gangguan koneksi otak AI.";
    
    if (error.message?.includes("429") || error.message?.includes("rate_limit")) {
        friendlyMessage = "💤 Limit Harian Tercapai! Kuota LLaMA 3 sedang istirahat. Coba lagi besok ya, Chief!";
    }

    return NextResponse.json({ summary: friendlyMessage }, { headers: corsHeaders });
  }
}