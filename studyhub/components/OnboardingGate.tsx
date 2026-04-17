'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { OnboardingModal } from './OnboardingModal'

interface OnboardingGateProps {
  onboardingDone: boolean
}

export function OnboardingGate({ onboardingDone }: OnboardingGateProps) {
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!onboardingDone) {
      const t = setTimeout(() => setShowModal(true), 600)
      return () => clearTimeout(t)
    }
  }, [onboardingDone])

  if (!showModal) return null

  return (
    <OnboardingModal
      onComplete={() => {
        setShowModal(false)
        // Refresh server component supaya onboardingDone terbaca true dari DB
        router.refresh()
      }}
    />
  )
}
