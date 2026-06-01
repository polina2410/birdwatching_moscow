'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { toast } from 'sonner'

function AdminHomeContent() {
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('error') === 'superadmin_required') {
      toast.error('Раздел доступен только для SUPERADMIN.')
    }
  }, [searchParams])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Панель управления</h1>
      <p className="text-muted-foreground">Выберите раздел в боковом меню.</p>
    </div>
  )
}

export default function AdminPage() {
  return (
    <Suspense>
      <AdminHomeContent />
    </Suspense>
  )
}