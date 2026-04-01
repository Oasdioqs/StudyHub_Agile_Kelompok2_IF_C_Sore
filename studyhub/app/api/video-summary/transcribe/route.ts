import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const groqKey = process.env.GROQ_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  if (!groqKey && !openaiKey) {
    return NextResponse.json({
      error: 'NO_TRANSCRIPTION_KEY',
      message: 'Tab Audio membutuhkan GROQ_API_KEY (gratis di console.groq.com) atau OPENAI_API_KEY di .env',
    }, { status: 503 })
  }

  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null
    if (!audioFile || audioFile.size === 0) {
      return NextResponse.json({ error: 'No audio data received' }, { status: 400 })
    }

    const ext = audioFile.type.includes('ogg') ? 'ogg' : 'webm'
    const file = new File([audioFile], `audio.${ext}`, { type: audioFile.type || 'audio/webm' })

    const whisperForm = new FormData()
    whisperForm.append('file', file)
    whisperForm.append('model', groqKey ? 'whisper-large-v3-turbo' : 'whisper-1')
    whisperForm.append('response_format', 'json')

    const apiUrl = groqKey
      ? 'https://api.groq.com/openai/v1/audio/transcriptions'
      : 'https://api.openai.com/v1/audio/transcriptions'
    const apiKey = groqKey ?? openaiKey!

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => String(response.status))
      console.error('Whisper transcription failed:', response.status, errText)
      return NextResponse.json({ error: 'Transcription API error', details: errText }, { status: 502 })
    }

    const data = await response.json()
    return NextResponse.json({ text: (data.text ?? '').trim() })
  } catch (e: any) {
    console.error('Transcribe route error:', e)
    return NextResponse.json({ error: e.message ?? 'Internal error' }, { status: 500 })
  }
}
