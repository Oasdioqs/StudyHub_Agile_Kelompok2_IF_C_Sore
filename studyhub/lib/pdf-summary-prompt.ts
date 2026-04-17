import { MARKER_PDF_SCAN, MARKER_VISUAL_EMBEDDED } from '@/lib/document-visual-enrichment'

export function buildSummaryPrompt(title: string, extractedText: string): string {
  const hasScanOcr = extractedText.includes(MARKER_PDF_SCAN)
  const hasEmbeddedVisual = extractedText.includes(MARKER_VISUAL_EMBEDDED)
  const hasAnyVisual = hasScanOcr || hasEmbeddedVisual
  const truncated = extractedText.slice(0, 45000)

  const visualRules = hasAnyVisual
    ? `

INSTRUKSI KHUSUS GAMBAR & VISUAL (WAJIB):
- Dokumen memuat bagian visual (scan PDF dan/atau gambar dari Word/PowerPoint). Jangan abaikan.
- Semua gambar di dokumen dianalisis; yang bertanda "materi" di sumber teks punya cuplikan di galeri ringkasan — rujuk jelas (mis. "gambar materi ke-2", "slide pada gambar image5.png"). Yang bertanda "dekorasi" (logo, watermark) jangan dipaksakan sebagai konsep utama.
- Jelaskan SETIAP diagram, grafik, screenshot, foto, atau ilustrasi penting: apa isinya, apa maksudnya dalam konteks materi, dan hubungannya dengan teks di slide/bab.
- Sisipkan ringkasan visual ke dalam poin-poin kunci; gunakan frasa seperti "Pada diagram X terlihat bahwa…", "Gambar Y mengilustrasikan…".
- Section "## 🖼️ Gambar, diagram, & visual" merangkum semua visual penting (boleh satu paragraf per sumber bila banyak).
- Jika ada teks dalam gambar yang sudah di-OCR, padukan dengan narasi, jangan duplikasi tanpa makna.
`
    : ''

  return `Kamu adalah asisten akademik ahli. Buat ringkasan LENGKAP dan KOMPREHENSIF dari dokumen "${title}" dalam Bahasa Indonesia.

INSTRUKSI WAJIB:
1. Jangan lewatkan informasi penting apapun dari teks maupun penjelasan visual
2. Jika ada kode program (teks atau dari gambar/OCR), WAJIB sertakan dalam code block lengkap
3. Rumus, algoritma, dan definisi teknis harus jelas; gunakan markdown untuk rumus sederhana jika perlu (mis. \`a^2 + b^2\`)
4. Tutup dengan kalimat yang menghubungkan konsep utama${visualRules}

FORMAT RINGKASAN (gunakan markdown):

## 📌 Topik Utama
[1-2 paragraf: fokus dokumen, audiens, dan garis besar isi]

## 🔑 Poin-poin Kunci
[Minimal 8-14 poin detail — gabungkan wawasan dari teks DAN visual; sub-bullet untuk turunan konsep]

## 🖼️ Gambar, diagram, & visual
${hasAnyVisual ? 'Wajib: rangkum setiap visual penting (jenis, isi, maksud, kaitan dengan materi). Satu paragraf per kelompok halaman/slide bila perlu.' : 'Tulis: tidak ada bagian analisis visual dalam sumber ekstraksi (hanya teks).'}

## 💻 Kode & Implementasi
[Jika ada kode, sertakan yang penting dalam:
\`\`\`bahasa
// kode
\`\`\`
Jika tidak ada → "Tidak ada kode program dalam dokumen ini"]

## 📐 Rumus & Konsep Teknis
[Rumus, notasi, alur algoritme — atau hapus section jika tidak relevan]

## 🔗 Rangkuman integrasi
[1 paragraf: bagaimana teks, visual, dan contoh saling melengkapi]

## ✅ Kesimpulan
[2-4 kalimat penutup]

ISI DOKUMEN (teks + cuplikan analisis visual):
${truncated}`
}
