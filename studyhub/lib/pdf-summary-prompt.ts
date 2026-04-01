export function buildSummaryPrompt(title: string, extractedText: string): string {
  const hasOcr = extractedText.includes('=== KONTEN DARI GAMBAR/HALAMAN SCAN ===')
  const truncated = extractedText.slice(0, 45000)

  return `Kamu adalah asisten akademik ahli. Buat ringkasan LENGKAP dan KOMPREHENSIF dari dokumen "${title}" dalam Bahasa Indonesia.

INSTRUKSI WAJIB:
1. Jangan lewatkan informasi penting apapun
2. Jika ada kode program (baik dari teks maupun hasil OCR gambar), WAJIB sertakan dalam code block lengkap
3. Semua rumus, algoritma, dan definisi teknis harus disertakan${hasOcr ? '\n4. Dokumen ini mengandung halaman gambar/scan — analisis bagian OCR dengan cermat' : ''}

FORMAT RINGKASAN (gunakan markdown):

## 📌 Topik Utama
[1-2 paragraf menjelaskan topik dan tujuan dokumen]

## 🔑 Poin-poin Kunci
[Minimal 8-12 poin detail — jangan terlalu singkat, gunakan sub-poin jika perlu]

## 💻 Kode & Implementasi
[Jika ada kode program, sertakan SEMUA kode penting dalam code block berformat:
\`\`\`bahasa
// kode di sini
\`\`\`
Jika tidak ada kode → tulis "Tidak ada kode program dalam dokumen ini"]

## 📐 Rumus & Konsep Teknis
[Sertakan rumus matematika, algoritma, atau konsep teknis penting — jika tidak ada, skip section ini]

## ✅ Kesimpulan
[2-3 kalimat penutup yang mencakup poin terpenting]

ISI DOKUMEN:
${truncated}`
}
