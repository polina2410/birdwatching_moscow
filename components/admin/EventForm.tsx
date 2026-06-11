'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { createEvent, updateEvent, publishEvent, cancelEvent, deleteEvent, restoreEvent } from '@/app/admin/events/_actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Event, ExpeditionDay, EventStatus } from '@/generated/prisma/client'
import { MAX_EVENT_TITLE, MAX_EVENT_LOCATION, MAX_DESCRIPTION, MAX_URL } from '@/lib/constants'
import { useAdminAction } from '@/hooks/useAdminAction'
import { generateSlug } from '@/lib/utils'

type GuideOption = { id: string; name: string }
type EventWithDays = Event & { days: ExpeditionDay[]; guides: { id: string }[]; _count: { tickets: number } }

type Props =
  | { event?: undefined; guides: GuideOption[] }
  | { event: EventWithDays; guides: GuideOption[] }

const toDatetimeLocal = (d: Date | string) => {
  const date = new Date(d)
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

const eventFormSchema = z.object({
  type: z.enum(['WALK', 'EXPEDITION']),
  title: z.string().min(1, 'Обязательное поле').max(MAX_EVENT_TITLE, `Максимум ${MAX_EVENT_TITLE} символов`),
  description: z.string().max(MAX_DESCRIPTION, `Максимум ${MAX_DESCRIPTION} символов`),
  startsAt: z.string().min(1, 'Обязательное поле'),
  location: z.string().min(1, 'Обязательное поле').max(MAX_EVENT_LOCATION, `Максимум ${MAX_EVENT_LOCATION} символов`),
  coverPhotoUrl: z.string().min(1, 'Обязательное поле').url('Введите корректный URL').max(MAX_URL),
  galleryUrls: z.array(z.object({ value: z.string() })),
  birdSpecies: z.string(),
  slug: z.string(),
  priceRubles: z.string(),
  capacity: z.string(),
  totalSpots: z.string(),
  spotsLeft: z.string(),
  days: z.array(z.object({
    clientId: z.string(),
    dayNumber: z.string(),
    title: z.string(),
    description: z.string(),
  })),
  guideIds: z.array(z.string()),
}).superRefine((data, ctx) => {
  if (data.type === 'WALK') {
    if (!data.priceRubles.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Обязательное поле', path: ['priceRubles'] })
    if (!data.capacity.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Обязательное поле', path: ['capacity'] })
  } else {
    if (!data.totalSpots.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Обязательное поле', path: ['totalSpots'] })
    if (data.days.length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Добавьте хотя бы один день', path: ['days'] })
    if (data.guideIds.length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Выберите хотя бы одного гида', path: ['guideIds'] })
    const total = parseInt(data.totalSpots || '0', 10)
    const left = parseInt(data.spotsLeft || '0', 10)
    if (!isNaN(total) && !isNaN(left) && left > total) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Осталось мест не может превышать общее количество мест', path: ['spotsLeft'] })
    }
  }
})

type FormValues = z.infer<typeof eventFormSchema>

const STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'Активно',
  CANCELLED: 'Отменено',
  DELETED: 'Удалено',
}

export const EventForm = ({ event, guides }: Props) => {
  const router = useRouter()
  const { act, isPending, startTransition } = useAdminAction()
  const [deleteModal, setDeleteModal] = useState(false)
  const [cancelModal, setCancelModal] = useState(false)
  const [restoreModal, setRestoreModal] = useState(false)
  const [newStartsAt, setNewStartsAt] = useState('')

  const isEdit = !!event
  const status = event?.status ?? 'DRAFT'
  const isDeleted = status === 'DELETED'

  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      type: (event?.type ?? 'WALK') as 'WALK' | 'EXPEDITION',
      title: event?.title ?? '',
      description: event?.description ?? '',
      startsAt: event?.startsAt ? toDatetimeLocal(event.startsAt) : '',
      location: event?.location ?? '',
      coverPhotoUrl: event?.coverPhotoUrl ?? '',
      galleryUrls: (event?.galleryUrls ?? []).map((v) => ({ value: v })),
      birdSpecies: (event?.birdSpecies ?? []).join(', '),
      slug: event?.slug ?? '',
      priceRubles: event?.priceKopecks != null ? String(event.priceKopecks / 100) : '',
      capacity: event?.capacity != null ? String(event.capacity) : '',
      totalSpots: event?.totalSpots != null ? String(event.totalSpots) : '',
      spotsLeft: event?.spotsLeft != null ? String(event.spotsLeft) : '',
      days: event?.days.map((d) => ({
        clientId: crypto.randomUUID(),
        dayNumber: String(d.dayNumber),
        title: d.title,
        description: d.description,
      })) ?? [],
      guideIds: event?.guides.map((g) => g.id) ?? [],
    },
  })

  const { fields: galleryFields, append: addGallery, remove: removeGallery } = useFieldArray({ control, name: 'galleryUrls' })
  const { fields: dayFields, append: addDay, remove: removeDay } = useFieldArray({ control, name: 'days' })

  const type = watch('type')
  const title = watch('title')
  const slug = watch('slug')
  const guideIds = watch('guideIds')

  const buildInput = (data: FormValues) => ({
    type: data.type,
    title: data.title,
    description: data.description,
    startsAt: new Date(data.startsAt).toISOString(),
    location: data.location,
    coverPhotoUrl: data.coverPhotoUrl,
    galleryUrls: data.galleryUrls.map((g) => g.value).filter(Boolean),
    birdSpecies: data.birdSpecies.split(',').map((s) => s.trim()).filter(Boolean),
    slug: data.slug || generateSlug(data.title),
    ...(data.type === 'WALK'
      ? {
          priceKopecks: Math.round(parseFloat(data.priceRubles || '0') * 100),
          capacity: parseInt(data.capacity || '0', 10),
        }
      : {
          totalSpots: parseInt(data.totalSpots || '0', 10),
          spotsLeft: parseInt(data.spotsLeft || '0', 10),
          days: data.days.map((d) => ({
            clientId: d.clientId,
            dayNumber: parseInt(d.dayNumber, 10),
            title: d.title,
            description: d.description,
          })),
          guideIds: data.guideIds,
        }),
  })

  const onSaveDraft = handleSubmit(async (data) => {
    const input = buildInput(data)
    if (isEdit) {
      act(() => updateEvent(event.id, input as Parameters<typeof updateEvent>[1]), 'Сохранено')
    } else {
      startTransition(async () => {
        try {
          const { id, slug: finalSlug } = await createEvent(input as Parameters<typeof createEvent>[0], false)
          toast.success(`Сохранено. URL: /${type === 'WALK' ? 'events' : 'expeditions'}/${finalSlug}`)
          router.push(`/admin/events/${id}`)
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Ошибка')
        }
      })
    }
  })

  const onPublish = handleSubmit(async (data) => {
    const input = buildInput(data)
    if (isEdit) {
      act(() => publishEvent(event.id), 'Опубликовано')
    } else {
      startTransition(async () => {
        try {
          const { id, slug: finalSlug } = await createEvent(input as Parameters<typeof createEvent>[0], true)
          toast.success(`Опубликовано. URL: /${type === 'WALK' ? 'events' : 'expeditions'}/${finalSlug}`)
          router.push(`/admin/events/${id}`)
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Ошибка')
        }
      })
    }
  })

  const handleRestoreClick = () => {
    if (event && new Date(event.startsAt) < new Date()) {
      setRestoreModal(true)
      setNewStartsAt('')
    } else {
      act(() => restoreEvent(event!.id), 'Восстановлено')
    }
  }

  const ticketCount = event?._count?.tickets ?? 0
  const canDelete = status === 'DRAFT' || status === 'CANCELLED'

  const fieldDisabled = isDeleted || isPending

  return (
    <form className="space-y-6 max-w-2xl">
      {isEdit && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{STATUS_LABELS[status]}</Badge>
        </div>
      )}

      {!isEdit && (
        <div>
          <Label>Тип события</Label>
          <div className="flex gap-4 mt-1">
            {(['WALK', 'EXPEDITION'] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value={t}
                  checked={type === t}
                  onChange={() => setValue('type', t)}
                  disabled={fieldDisabled}
                />
                {t === 'WALK' ? 'Прогулка' : 'Экспедиция'}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="title">Название *</Label>
        <Input
          id="title"
          {...register('title', { onChange: (e) => { if (!isEdit) setValue('slug', generateSlug(e.target.value)) } })}
          disabled={fieldDisabled}
          placeholder="Название события"
        />
        {errors.title && <p className="text-destructive text-sm mt-1">{errors.title.message}</p>}
      </div>

      <div>
        <Label htmlFor="slug">Slug (URL)</Label>
        {isEdit ? (
          <div>
            <Input id="slug" value={event.slug} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground mt-1">URL зафиксирован.</p>
          </div>
        ) : (
          <div>
            <Input id="slug" {...register('slug')} disabled={fieldDisabled} />
            <p className="text-xs text-muted-foreground mt-1">
              Предпросмотр: /{type === 'WALK' ? 'events' : 'expeditions'}/{slug || generateSlug(title)}
            </p>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="description">Описание</Label>
        <Textarea id="description" {...register('description')} disabled={fieldDisabled} rows={5} />
        {errors.description && <p className="text-destructive text-sm mt-1">{errors.description.message}</p>}
      </div>

      <div>
        <Label htmlFor="startsAt">Дата начала *</Label>
        <Input id="startsAt" type="datetime-local" {...register('startsAt')} disabled={fieldDisabled} />
        {errors.startsAt && <p className="text-destructive text-sm mt-1">{errors.startsAt.message}</p>}
      </div>

      <div>
        <Label htmlFor="location">Место *</Label>
        <Input id="location" {...register('location')} disabled={fieldDisabled} />
        {errors.location && <p className="text-destructive text-sm mt-1">{errors.location.message}</p>}
      </div>

      <div>
        <Label htmlFor="coverPhotoUrl">Обложка (URL) *</Label>
        <Input id="coverPhotoUrl" type="url" {...register('coverPhotoUrl')} disabled={fieldDisabled} />
        {errors.coverPhotoUrl && <p className="text-destructive text-sm mt-1">{errors.coverPhotoUrl.message}</p>}
      </div>

      <div>
        <Label>Галерея (URL)</Label>
        <div className="space-y-2 mt-1">
          {galleryFields.map((field, idx) => (
            <div key={field.id} className="flex gap-2">
              <Input type="url" {...register(`galleryUrls.${idx}.value`)} disabled={fieldDisabled} />
              <Button type="button" variant="outline" size="sm" onClick={() => removeGallery(idx)} disabled={fieldDisabled}>
                ✕
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => addGallery({ value: '' })} disabled={fieldDisabled}>
            + Добавить URL
          </Button>
        </div>
      </div>

      <div>
        <Label htmlFor="birdSpecies">Виды птиц (через запятую)</Label>
        <Input id="birdSpecies" {...register('birdSpecies')} disabled={fieldDisabled} placeholder="Снегирь, Синица, Дятел" />
      </div>

      {/* Walk-only */}
      {type === 'WALK' && (
        <>
          <div>
            <Label htmlFor="priceRubles">Цена (руб.) *</Label>
            <div className="flex items-center gap-2">
              <Input id="priceRubles" type="number" min="0" step="0.01" {...register('priceRubles')} disabled={fieldDisabled} className="max-w-xs" />
              <span className="text-sm text-muted-foreground">руб.</span>
            </div>
            {errors.priceRubles && <p className="text-destructive text-sm mt-1">{errors.priceRubles.message}</p>}
          </div>
          <div>
            <Label htmlFor="capacity">Количество мест *</Label>
            <Input id="capacity" type="number" min="1" {...register('capacity')} disabled={fieldDisabled} className="max-w-xs" />
            {errors.capacity && <p className="text-destructive text-sm mt-1">{errors.capacity.message}</p>}
          </div>
        </>
      )}

      {/* Expedition-only */}
      {type === 'EXPEDITION' && (
        <>
          <div className="flex gap-4">
            <div>
              <Label htmlFor="totalSpots">Всего мест *</Label>
              <Input id="totalSpots" type="number" min="1" {...register('totalSpots')} disabled={fieldDisabled} className="max-w-[140px]" />
              {errors.totalSpots && <p className="text-destructive text-sm mt-1">{errors.totalSpots.message}</p>}
            </div>
            <div>
              <Label htmlFor="spotsLeft">Осталось мест *</Label>
              <Input id="spotsLeft" type="number" min="0" {...register('spotsLeft')} disabled={fieldDisabled} className="max-w-[140px]" />
            </div>
          </div>

          <div>
            <Label>Дни экспедиции *</Label>
            <div className="space-y-4 mt-2">
              {dayFields.map((field, idx) => (
                <div key={field.id} className="border rounded p-4 space-y-2 relative">
                  <div className="flex gap-3 items-start">
                    <div className="w-20">
                      <Label>День №</Label>
                      <Input type="number" min="1" {...register(`days.${idx}.dayNumber`)} disabled={fieldDisabled} />
                    </div>
                    <div className="flex-1">
                      <Label>Название</Label>
                      <Input {...register(`days.${idx}.title`)} disabled={fieldDisabled} />
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeDay(idx)} disabled={fieldDisabled} className="mt-6">
                      ✕
                    </Button>
                  </div>
                  <div>
                    <Label>Описание</Label>
                    <Textarea {...register(`days.${idx}.description`)} disabled={fieldDisabled} rows={2} />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => addDay({ clientId: crypto.randomUUID(), dayNumber: String(dayFields.length + 1), title: '', description: '' })}
                disabled={fieldDisabled}
              >
                + Добавить день
              </Button>
            </div>
            {errors.days?.root?.message && (
              <p className="text-destructive text-sm mt-1">{errors.days.root.message}</p>
            )}
          </div>

          <div>
            <Label>Гиды * (выберите хотя бы одного)</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {guides.map((g) => (
                <label key={g.id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={guideIds.includes(g.id)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...guideIds, g.id]
                        : guideIds.filter((id) => id !== g.id)
                      setValue('guideIds', next)
                    }}
                    disabled={fieldDisabled}
                  />
                  {g.name}
                </label>
              ))}
            </div>
            {errors.guideIds?.root?.message && (
              <p className="text-destructive text-sm mt-1">{errors.guideIds.root.message}</p>
            )}
          </div>
        </>
      )}

      {/* Action buttons */}
      {!isDeleted && (
        <div className="flex flex-wrap gap-3 pt-4 border-t">
          {(status === 'DRAFT' || !isEdit) && (
            <>
              <Button type="button" variant="outline" onClick={onSaveDraft} disabled={isPending}>
                {isEdit ? 'Сохранить' : 'Сохранить как черновик'}
              </Button>
              <Button type="button" onClick={onPublish} disabled={isPending}>
                {isEdit ? 'Опубликовать' : 'Сохранить и опубликовать'}
              </Button>
            </>
          )}
          {status === 'ACTIVE' && isEdit && (
            <>
              <Button type="button" variant="outline" onClick={onSaveDraft} disabled={isPending}>Сохранить</Button>
              <Button type="button" variant="destructive" onClick={() => setCancelModal(true)} disabled={isPending}>
                Отменить событие
              </Button>
            </>
          )}
          {status === 'CANCELLED' && isEdit && (
            <>
              <Button type="button" variant="outline" onClick={onSaveDraft} disabled={isPending}>Сохранить</Button>
              <Button type="button" onClick={handleRestoreClick} disabled={isPending}>Восстановить</Button>
            </>
          )}

          {canDelete && isEdit && (
            ticketCount > 0 ? (
              <Tooltip>
                <TooltipTrigger render={<span className="inline-block" />}>
                  <Button type="button" variant="destructive" disabled>Удалить</Button>
                </TooltipTrigger>
                <TooltipContent>Нельзя удалить событие с проданными билетами. Используйте отмену.</TooltipContent>
              </Tooltip>
            ) : (
              <Button type="button" variant="destructive" onClick={() => setDeleteModal(true)} disabled={isPending}>
                Удалить
              </Button>
            )
          )}
        </div>
      )}

      {/* Delete modal */}
      <Dialog open={deleteModal} onOpenChange={setDeleteModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Удалить событие?</DialogTitle></DialogHeader>
          <p>Событие исчезнет из панели управления. Это действие нельзя отменить через UI.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModal(false)}>Отмена</Button>
            <Button variant="destructive" disabled={isPending} onClick={() => {
              setDeleteModal(false)
              act(() => deleteEvent(event!.id), 'Удалено')
            }}>Удалить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel modal */}
      <Dialog open={cancelModal} onOpenChange={setCancelModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Отменить событие?</DialogTitle></DialogHeader>
          <p>Статус изменится на «Отменено». Билеты останутся у покупателей.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelModal(false)}>Назад</Button>
            <Button variant="destructive" disabled={isPending} onClick={() => {
              setCancelModal(false)
              act(() => cancelEvent(event!.id), 'Отменено')
            }}>Отменить событие</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore with new date modal */}
      <Dialog open={restoreModal} onOpenChange={setRestoreModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Восстановить событие</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Дата начала уже прошла. Укажите новую дату.</p>
          <Input type="datetime-local" value={newStartsAt} onChange={(e) => setNewStartsAt(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreModal(false)}>Отмена</Button>
            <Button disabled={!newStartsAt || isPending} onClick={() => {
              setRestoreModal(false)
              act(() => restoreEvent(event!.id, new Date(newStartsAt).toISOString()), 'Восстановлено')
            }}>Восстановить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
