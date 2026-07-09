import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle preflight request (CORS)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
      return NextResponse.json({ 
          summary: "🚨 Waduh Chief, API Key Gemini kita belum terpasang. Cek Environment Variables!" 
      }, { headers: corsHeaders });
  }

  try {
    // Frontend harus mengirimkan array atau string gabungan dari jurnal seminggu terakhir
    const { journals, userName } = await req.json();

    // Validasi jika jurnal masih kosong
    if (!journals || journals.length === 0) {
        return NextResponse.json({ 
            summary: "📝 Belum ada catatan jurnal minggu ini untuk dianalisis, Chief. Yuk mulai nulis!" 
        }, { headers: corsHeaders });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Kita gunakan model flash saja karena cepat dan cocok untuk merangkum teks panjang
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Kamu adalah 'Bri9 Life Analyzer', analis psikologi dan asisten produktivitas pribadi untuk ${userName}. 
    
    Tugasmu:
    Baca seluruh catatan jurnal harian berikut yang ditulis oleh ${userName} selama seminggu terakhir ini. Analisis pola pikirnya, tingkat stresnya, dan antusiasmenya.
    
    Berikan rangkuman mingguan dengan struktur berikut:
    1. 🧠 Kondisi Mental & Fokus: (Bagaimana mood dan fokus utamanya minggu ini?)
    2. 🏆 Pencapaian Terbesar: (Apa hal terbaik atau rintangan terberat yang berhasil dia lewati?)
    3. 💡 Saran Jarvis: (Berikan 1 kalimat motivasi/saran teknis agar minggu depan lebih baik).
    
    Jawab dengan bahasa yang asik, suportif, profesional ala asisten AI pribadi. Gunakan emoji secukupnya dan pastikan formatnya rapi (maksimal 3-4 paragraf).
    
    Berikut adalah kumpulan jurnal ${userName} selama 7 hari terakhir:
    """
    ${journals}
    """`;

    const result = await model.generateContent(prompt);
    const aiSummary = result.response.text();

    return NextResponse.json({ 
        summary: aiSummary 
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error("AI WEEKLY SUMMARY ERROR:", error);
    
    // Sistem Pendeteksi Error Cerdas (sama seperti sebelumnya)
    let friendlyMessage = "🚨 Waduh Chief, gagal menganalisis rangkuman mingguan karena gangguan koneksi otak AI.";
    
    if (error.message.includes("429") || error.message.includes("Quota")) {
        friendlyMessage = "💤 Limit Harian Tercapai!\n\nAI butuh istirahat, kuota untuk merangkum jurnal minggu ini sudah habis. Coba lagi besok ya, Chief!";
    } else if (error.message.includes("503") || error.message.includes("Unavailable")) {
        friendlyMessage = "🔥 Server AI Overload!\n\nServer pusat sedang pusing membaca jurnal Anda. Coba beberapa menit lagi.";
    }

    return NextResponse.json({ summary: friendlyMessage }, { headers: corsHeaders });
  }
}