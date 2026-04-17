import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { authOptions } from '@/lib/auth'
import {
  BLOB_STAGING_MAX_BYTES,
  isBlobUploadConfigured,
} from '@/lib/document-kind'

export const runtime = 'nodejs'

const ALLOWED = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const

export async function POST(request: Request): Promise<NextResponse> {
  if (!isBlobUploadConfigured()) {
    return NextResponse.json(
      { error: 'Upload besar belum dikonfigurasi (tanpa BLOB_READ_WRITE_TOKEN).' },
      { status: 503 },
    )
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: HandleUploadBody
  try {
    body = (await request.json()) as HandleUploadBody
  } catch {
    return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 })
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, _clientPayload, _multipart) => {
        return {
          allowedContentTypes: [...ALLOWED],
          maximumSizeInBytes: BLOB_STAGING_MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: session.user!.id }),
        }
      },
      onUploadCompleted: async () => {
        /* Proses dokumen lewat POST /api/pdf { fromBlobUrl } — tidak simpan URL di sini */
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload gagal'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
