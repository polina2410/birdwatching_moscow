'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { cancelEvent, deleteEvent, publishEvent, restoreEvent } from '@/app/admin/events/_actions'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDebounce } from '@/lib/useDebounce'
import { useAdminAction } from '@/hooks/useAdminAction'
import type { EventStatus, EventType } from '@/generated/prisma/client'

type EventRow = {
  id: string
  title: string
  type: EventType
  status: EventStatus
  startsAt: Date
  publishedAt: Date | null
  _count: { tickets: number }
}

const STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'Активно',
  CANCELLED: 'Отменено',
  DELETED: 'Удалено',
}

const TYPE_LABELS: Record<EventType, string> = {
  WALK: 'Прогулка',
  EXPEDITION: 'Экспедиция',
}

type RestoreModalState = { open: false } | { open: true; id: string; startsAt: Date }

export const EventsTable = ({
  events,
  page,
  totalPages,
}: {
  events: EventRow[]
  page: number
  totalPages: number
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { act, isPending } = useAdminAction()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [cancelTarget, setCancelTarget] = useState<{ id: string; title: string } | null>(null)
  const [restoreModal, setRestoreModal] = useState<RestoreModalState>({ open: false })
  const [newStartsAt, setNewStartsAt] = useState('')

  const currentType = searchParams.get('type') ?? 'ALL'
  const currentStatus = searchParams.get('status') ?? ''
  const currentSearch = searchParams.get('search') ?? ''
  const [searchInput, setSearchInput] = useState(currentSearch)
  const debouncedSearch = useDebounce(searchInput, 400)

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

  useEffect(() => {
    const prevSearch = searchParams.get('search') ?? ''
    if (debouncedSearch !== prevSearch) updateParam('search', debouncedSearch)
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRestore = (ev: EventRow) => {
    if (new Date(ev.startsAt) < new Date()) {
      setRestoreModal({ open: true, id: ev.id, startsAt: ev.startsAt })
      setNewStartsAt('')
    } else {
      act(() => restoreEvent(ev.id), 'Восстановлено')
    }
  }

  const confirmRestore = () => {
    if (!restoreModal.open || !newStartsAt) return
    const id = restoreModal.id
    act(() => restoreEvent(id, new Date(newStartsAt).toISOString()), 'Восстановлено')
    setRestoreModal({ open: false })
  }

  return (
    <div className="space-y-4">
      <Tabs value={currentType} onValueChange={(v) => updateParam('type', v == null || v === 'ALL' ? '' : v)}>
        <TabsList>
          <TabsTrigger value="ALL">Все</TabsTrigger>
          <TabsTrigger value="WALK">Прогулки</TabsTrigger>
          <TabsTrigger value="EXPEDITION">Экспедиции</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex gap-3">
        <Input
          placeholder="Поиск по названию..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-xs"
        />
        <Select value={currentStatus || 'ALL'} onValueChange={(v) => updateParam('status', v == null || v === 'ALL' ? '' : v)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все статусы</SelectItem>
            <SelectItem value="DRAFT">Черновик</SelectItem>
            <SelectItem value="ACTIVE">Активно</SelectItem>
            <SelectItem value="CANCELLED">Отменено</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Название</TableHead>
            <TableHead>Тип</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Дата начала</TableHead>
            <TableHead>Опубликовано</TableHead>
            <TableHead>Билеты</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Нет событий
              </TableCell>
            </TableRow>
          )}
          {events.map((ev) => (
            <TableRow key={ev.id}>
              <TableCell>
                <Link href={`/admin/events/${ev.id}`} className="hover:underline font-medium">
                  {ev.title}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{TYPE_LABELS[ev.type]}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={ev.status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {STATUS_LABELS[ev.status]}
                </Badge>
              </TableCell>
              <TableCell>{format(new Date(ev.startsAt), 'd MMM yyyy, HH:mm', { locale: ru })}</TableCell>
              <TableCell>
                {ev.publishedAt ? format(new Date(ev.publishedAt), 'd MMM yyyy', { locale: ru }) : '—'}
              </TableCell>
              <TableCell>{ev.type === 'WALK' ? ev._count.tickets : '—'}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                    •••
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Link href={`/admin/events/${ev.id}`}>Редактировать</Link>
                    </DropdownMenuItem>
                    {ev.status === 'DRAFT' && (
                      <DropdownMenuItem onClick={() => act(() => publishEvent(ev.id), 'Опубликовано')}>
                        Опубликовать
                      </DropdownMenuItem>
                    )}
                    {ev.status === 'ACTIVE' && (
                      <DropdownMenuItem onClick={() => setCancelTarget({ id: ev.id, title: ev.title })}>
                        Отменить
                      </DropdownMenuItem>
                    )}
                    {ev.status === 'CANCELLED' && (
                      <DropdownMenuItem onClick={() => handleRestore(ev)}>
                        Восстановить
                      </DropdownMenuItem>
                    )}
                    {(ev.status === 'DRAFT' || ev.status === 'CANCELLED') && (
                      ev._count.tickets > 0 ? (
                        <Tooltip>
                          <TooltipTrigger render={<span className="block" />}>
                            <DropdownMenuItem disabled>Удалить</DropdownMenuItem>
                          </TooltipTrigger>
                          <TooltipContent>Нельзя удалить событие с проданными билетами. Используйте отмену.</TooltipContent>
                        </Tooltip>
                      ) : (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteTarget({ id: ev.id, title: ev.title })}
                        >
                          Удалить
                        </DropdownMenuItem>
                      )
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
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

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить событие?</DialogTitle>
          </DialogHeader>
          <p>«{deleteTarget?.title}» будет удалено и исчезнет из списка.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Отмена</Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                if (!deleteTarget) return
                const id = deleteTarget.id
                setDeleteTarget(null)
                act(() => deleteEvent(id), 'Удалено')
              }}
            >
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отменить событие?</DialogTitle>
          </DialogHeader>
          <p>«{cancelTarget?.title}» будет переведено в статус «Отменено».</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Назад</Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                if (!cancelTarget) return
                const id = cancelTarget.id
                setCancelTarget(null)
                act(() => cancelEvent(id), 'Отменено')
              }}
            >
              Отменить событие
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore with new date */}
      <Dialog open={restoreModal.open} onOpenChange={(o) => !o && setRestoreModal({ open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Восстановить событие</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Дата начала этого события уже прошла. Укажите новую дату перед восстановлением.
          </p>
          <Input
            type="datetime-local"
            value={newStartsAt}
            onChange={(e) => setNewStartsAt(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreModal({ open: false })}>Отмена</Button>
            <Button disabled={!newStartsAt || isPending} onClick={confirmRestore}>
              Восстановить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
