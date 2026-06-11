'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export const useAdminAction = () => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const act = (fn: () => Promise<void>, successMsg: string) => {
    startTransition(async () => {
      try {
        await fn()
        toast.success(successMsg)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Ошибка')
      }
    })
  }

  return { act, isPending, startTransition }
}