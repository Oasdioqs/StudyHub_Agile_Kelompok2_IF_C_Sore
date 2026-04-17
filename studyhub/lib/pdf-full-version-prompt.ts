import type { DocumentKind } from '@/lib/document-kind'

const MAX_EXTRACTED = 78_000

function unitLabel(kind: DocumentKind, pageCount: number): string {
  if (kind === 'pptx') return pageCount > 0 ? `${pageCount} slide` : 'setiap slide yang terdeteksi di teks'
  if (kind === 'docx') return pageCount > 0 ? `${pageCount} halaman (perkiraan)` : 'setiap bagian logis dokumen'
  return pageCount > 0 ? `${pageCount} halaman` : 'setiap halaman yang dapat diidentifikasi dari teks'
}

/**
 * Prompt untuk penjelasan lengkap per halaman/slide (bukan ringkasan singkat).
 */
export function buildFullVersionPrompt(
  title: string,
  kind: DocumentKind,
  pageCount: number,
  extractedText: string,
): string {
  const unit = unitLabel(kind, pageCount)
  const truncated = extractedText.slice(0, MAX_EXTRACTED)

  const structureHint =
    kind === 'pptx'
      ? 'Jika teks memuat pemisah seperti "--- Slide N ---" atau pola serupa, ikuti urutan slide itu persis.'
      : kind === 'docx'
        ? 'Bagi dokumen Word menjadi bagian berurutan (mis. per heading besar atau blok paragraf yang koheren) bila tidak ada nomor halaman eksplisit.'
        : 'Bagi menjadi ## Halaman 1, ## Halaman 2, … sampai mencakup seluruh rentang yang masuk akal dari teks. Jika teks tidak memisahkan halaman, perkirakan pembagian merata atau per blok topik yang jelas.'

  const headingExample =
    kind === 'pptx'
      ? '## Slide 1\n…\n## Slide 2\n…'
      : kind === 'docx'
        ? '## Bagian 1 — …\n…\n## Bagian 2 — …\n…'
        : '## Halaman 1\n…\n## Halaman 2\n…'

  return `Dokumen: "${title}"
Jenis file: ${kind.toUpperCase()}. Target cakupan: ${unit}.

TUGAS: Tulis VERSI LENGKAP dalam Bahasa Indonesia untuk pembelajaran. Ini BUKAN ringkasan abstrak — jelaskan isi secara sistematis agar pembaca memahami seluruh dokumen seolah membaca dari awal sampai akhir.

WAJIB:
1. ${structureHint}
2. Untuk SETIAP unit (halaman/slide/bagian): jelaskan poin-poin utama, istilah, data, dan hubungan antar ide. Jangan hanya satu kalimat per unit kecuali isinya memang kosong/minimal.
3. Sisipkan kode program penting dalam code block jika ada di sumber.
4. Jika ada analisis visual/gambar di teks sumber (mis. penjelasan diagram), padukan ke unit yang relevan.
5. Akhiri dengan section singkat "## Yang mungkin terlewat" hanya jika ada bagian teks yang tidak terpetakan ke unit manapun.

FORMAT (markdown):
## Gambaran umum
[2–4 paragraf: konteks dokumen, struktur, tujuan]

${headingExample}
[lakukan untuk semua unit hingga tercakup]

## Yang mungkin terlewat
[hanya jika perlu; jika tidak → tulis "Tidak ada — seluruh sumber terpetakan."]

ISI EKSTRAKSI DOKUMEN:
${truncated}`
}
