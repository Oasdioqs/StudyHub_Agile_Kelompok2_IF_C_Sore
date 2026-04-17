'use client'

import { useState, useEffect } from 'react'
import { OnboardingModal } from './OnboardingModal'

interface OnboardingGateProps {
  onboardingDone: boolean
}

export function OnboardingGate({ onboardingDone }: OnboardingGateProps) {
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (!onboardingDone) {
      // Small delay so dashboard loads first (better UX)
      const t = setTimeout(() => setShowModal(true), 600)
      return () => clearTimeout(t)
    }
  }, [onboardingDone])

  if (!showModal) return null

  return <OnboardingModal onComplete={() => setShowModal(false)} />
}
