'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { updateRequestStatus } from '@/app/admin/requests/_actions'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Request, RequestStatus, RequestType, EventStatus } from '@/generated/prisma/client'
import { REQUEST_MESSAGE_PREVIEW } from '@/lib/constants'

type RequestRow = Request & {
  event: { id: string; title: string; status: EventStatus } | null
}

const STATUS_LABELS: Record<RequestStatus, string> = {
  NEW: 'Новая',
  WAITLIST: 'Лист ожидания',
}

const TYPE_LABELS: Record<RequestType, string> = {
  PRIVATE_WALK: 'Прогулка',
  EXPEDITION: 'Экспедиция',
}

type Props = {
  requests: RequestRow[]
  page: number
  totalPages: number
  eventIdFilter?: string
}

export const RequestsTable = ({ requests, page, totalPages, eventIdFilter }: Props) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [detailRequest, setDetailRequest] = useState<RequestRow | null>(null)

  const currentStatus = searchParams.get('status') ?? ''
  const currentType = searchParams.get('type') ?? ''

  const updateParam = (key: string, value: string) => {
    const sp = new URLSearchParams(searchParams.toString())
    if (value) sp.set(key, value); else sp.delete(key)
    sp.delete('page')
    router.push(`${pathname}?${sp.toString()}`)
  }

  const goPage = (p: number) => {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('page', String(p))
    router.push(`${pathname}?${sp.toString()}`)
  }

  const toggleStatus = (req: RequestRow) => {
    const next: RequestStatus = req.status === 'NEW' ? 'WAITLIST' : 'NEW'
    startTransition(async () => {
      try {
        await updateRequestStatus(req.id, next)
        toast.success('Статус обновлён')
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Ошибка')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        {!eventIdFilter && (
          <Select value={currentType || 'ALL'} onValueChange={(v) => updateParam('type', v == null || v === 'ALL' ? '' : v)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Все типы</SelectItem>
              <SelectItem value="PRIVATE_WALK">Прогулки</SelectItem>
              <SelectItem value="EXPEDITION">Экспедиции</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={currentStatus || 'ALL'} onValueChange={(v) => updateParam('status', v == null || v === 'ALL' ? '' : v)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все статусы</SelectItem>
            <SelectItem value="NEW">Новые</SelectItem>
            <SelectItem value="WAITLIST">Лист ожидания</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Тип</TableHead>
            <TableHead>Событие</TableHead>
            <TableHead>Имя</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Сообщение</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Дата</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Нет заявок</TableCell>
            </TableRow>
          )}
          {requests.map((req) => (
            <TableRow key={req.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailRequest(req)}>
              <TableCell><Badge variant="outline">{TYPE_LABELS[req.type]}</Badge></TableCell>
              <TableCell>
                {req.event ? (
                  req.event.status === 'DELETED' ? (
                    <span className="text-muted-foreground">
                      {req.event.title} <Badge variant="destructive" className="text-xs ml-1">Удалено</Badge>
                    </span>
                  ) : (
                    <Link
                      href={`/admin/events/${req.event.id}`}
                      className="hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {req.event.title}
                      {req.event.status === 'CANCELLED' && (
                        <Badge variant="secondary" className="text-xs ml-1">Отменено</Badge>
                      )}
                    </Link>
                  )
                ) : '—'}
              </TableCell>
              <TableCell>{req.name}</TableCell>
              <TableCell>
                <a href={`mailto:${req.email}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                  {req.email}
                </a>
              </TableCell>
              <TableCell className="max-w-[200px]">
                <span className="truncate block text-sm text-muted-foreground">
                  {req.message.slice(0, REQUEST_MESSAGE_PREVIEW)}{req.message.length > REQUEST_MESSAGE_PREVIEW ? '…' : ''}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={req.status === 'NEW' ? 'default' : 'secondary'}>
                  {STATUS_LABELS[req.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{format(new Date(req.createdAt), 'd MMM yyyy', { locale: ru })}</TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={(e) => { e.stopPropagation(); toggleStatus(req) }}
                >
                  {req.status === 'NEW' ? '→ Ожидание' : '→ Новая'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex gap-2 justify-center">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" onClick={() => goPage(p)}>
              {p}
            </Button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      <Dialog open={!!detailRequest} onOpenChange={(o) => !o && setDetailRequest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Заявка</DialogTitle>
          </DialogHeader>
          {detailRequest && (
            <div className="space-y-3 text-sm">
              <div><span className="font-medium">Имя:</span> {detailRequest.name}</div>
              <div>
                <span className="font-medium">Email:</span>{' '}
                <a href={`mailto:${detailRequest.email}`} className="text-primary hover:underline">{detailRequest.email}</a>
              </div>
              <div><span className="font-medium">Тип:</span> {TYPE_LABELS[detailRequest.type]}</div>
              {detailRequest.event && (
                <div>
                  <span className="font-medium">Событие:</span> {detailRequest.event.title}
                </div>
              )}
              <div>
                <span className="font-medium">Статус:</span> {STATUS_LABELS[detailRequest.status]}
              </div>
              <div>
                <span className="font-medium">Дата:</span>{' '}
                {format(new Date(detailRequest.createdAt), 'd MMMM yyyy, HH:mm', { locale: ru })}
              </div>
              <div>
                <span className="font-medium">Сообщение:</span>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{detailRequest.message}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
