import type { DocumentKind } from '@/lib/document-kind'

const MAX_EXTRACTED = 78_000

function unitLabel(kind: DocumentKind, pageCount: number): string {
  if (kind === 'pptx') return pageCount > 0 ? `${pageCount} slide` : 'setiap slide'
  if (kind === 'docx') return pageCount > 0 ? `${pageCount} halaman` : 'setiap bagian'
  return pageCount > 0 ? `${pageCount} halaman` : 'setiap halaman'
}

/**
 * Prompt untuk penjelasan lengkap per halaman/slide.
 * STRICT: Setiap halaman HARUS ada penjelasan minimal 2-3 paragraf.
 */
export function buildFullVersionPrompt(
  title: string,
  kind: DocumentKind,
  pageCount: number,
  extractedText: string,
): string {
  const unit = unitLabel(kind, pageCount)
  const truncated = extractedText.slice(0, MAX_EXTRACTED)
  const isSlide = kind === 'pptx'
  const isDoc = kind === 'docx'

  // Unit name based on kind
  const unitName = isSlide ? 'Slide' : isDoc ? 'Bagian' : 'Halaman'

  // Page detection patterns
  const pageDetection = isSlide
    ? `Cari pola seperti "--- Slide N ---", "Slide N:", "[Slide N]", atau nomor slide yang jelas di teks. Ikuti urutan slide yang muncul di teks.`
    : isDoc
      ? `Identifikasi bagian utama dokumen: per heading (# Heading), per paragraf besar, atau per halaman yang ditandai. Jika tidak ada penanda halaman eksplisit, bagi teks menjadi bagian ${pageCount > 0 ? pageCount : 10} yang merata.`
      : `Gunakan penanda halaman eksplisit di teks (mis. "--- Halaman N ---", "[Page N]", nomor halaman). Jika TIDAK ADA penanda halaman, bagi teks menjadi ${pageCount > 0 ? pageCount : 10} bagian yang rata.`

  return `Dokumen: "${title}"
Jenis: ${kind.toUpperCase()} | Target: ${unit}

TUGAS: Tulis PENJELASAN LENGKAP per ${unitName.toLowerCase()} dalam Bahasa Indonesia.
❌ BUKAN ringkasan singkat — tapi PENJELASAN SISTEMATIS seperti guru menjelaskan ke murid.
❌ TIDAK BOLEH ada ${unitName.toLowerCase()} yang kosong atau hanya 1 kalimat.

ATURAN WAJIB:

1. **Deteksi ${unitName}**: ${pageDetection}

2. **SETIAP ${unitName.toUpperCase()} HARUS memiliki:**
   - Minimal 2-3 paragraf penjelasan (jika teks tersedia)
   - Jika teks pendek/minimal, tetap tulis 1 paragraf + catatan "Teks terbatas"
   - List poin-poin penting jika ada istilah/data/keyboard
   - Code block jika ada kode program

3. **Format per ${unitName.toLowerCase()}:**
${isSlide ? `   ## Slide N: [Judul Slide jika ada]
   [Paragraf penjelasan 2-3]
   - Poin penting 1
   - Poin penting 2
   [Kode jika ada]` : `   ## ${unitName} N
   [Paragraf penjelasan 2-3 paragraf]
   - Poin penting 1
   - Poin penting 2
   [Kode jika ada]`}

4. **Penutup**: Tambahkan section "## Ringkasan Akhir" dengan 3-5 poin kunci dari SELURUH dokumen.

FORMAT OUTPUT (WAJIB markdown):
## Gambaran Umum
[2-3 paragraf: konteks, tujuan dokumen, audiens]

${isSlide ? `## Slide 1: [Judul]
[Penjelasan 2-3 paragraf]
- Poin penting

## Slide 2: [Judul]
[Penjelasan 2-3 paragraf]
- Poin penting

... (lanjutkan untuk SEMUA slide hingga selesai)` : `## ${unitName} 1
[Penjelasan 2-3 paragraf]
- Poin penting

## ${unitName} 2
[Penjelasan 2-3 paragraf]
- Poin penting

... (lanjutkan untuk SEMUA ${unitName.toLowerCase()} hingga selesai)`}

## Ringkasan Akhir
[Poin kunci 3-5 dari seluruh dokumen]

ISI DOKUMEN (gunakan sebagai sumber):
${truncated}`
}
