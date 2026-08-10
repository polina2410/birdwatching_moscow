'use client'

import { useState, useEffect } from 'react'

export function useLooksLikeEmail(value: string, delay = 300): boolean {
  const [valid, setValid] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setValid(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    }, delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return valid
}
