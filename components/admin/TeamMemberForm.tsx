'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { createTeamMember, updateTeamMember } from '@/app/admin/team/_actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { TeamMember } from '@/generated/prisma/client'
import { MAX_NAME, MAX_DESCRIPTION, MAX_PROFILE_LINKS } from '@/lib/constants'

const teamMemberFormSchema = z.object({
  name: z.string().min(1, 'Обязательное поле').max(MAX_NAME, `Максимум ${MAX_NAME} символов`),
  photoUrl: z.string().min(1, 'Обязательное поле').url('Введите корректный URL'),
  education: z.string().max(MAX_DESCRIPTION, `Максимум ${MAX_DESCRIPTION} символов`),
  achievements: z.string().max(MAX_DESCRIPTION, `Максимум ${MAX_DESCRIPTION} символов`),
  profileLinks: z.array(z.object({ value: z.string() })).max(MAX_PROFILE_LINKS),
  sortOrder: z.string().regex(/^\d+$/, 'Введите целое число 0 или больше'),
})

type FormValues = z.infer<typeof teamMemberFormSchema>

export const TeamMemberForm = ({ member }: { member?: TeamMember }) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(teamMemberFormSchema),
    defaultValues: {
      name: member?.name ?? '',
      photoUrl: member?.photoUrl ?? '',
      education: member?.education ?? '',
      achievements: member?.achievements ?? '',
      profileLinks: (member?.profileLinks ?? []).map((v) => ({ value: v })),
      sortOrder: String(member?.sortOrder ?? 0),
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'profileLinks' })

  const onSubmit = handleSubmit((data) => {
    const input = {
      name: data.name,
      photoUrl: data.photoUrl,
      education: data.education || undefined,
      achievements: data.achievements || undefined,
      profileLinks: data.profileLinks.map((p) => p.value).filter(Boolean),
      sortOrder: parseInt(data.sortOrder, 10),
    }

    startTransition(async () => {
      try {
        if (member) {
          await updateTeamMember(member.id, input)
          toast.success('Сохранено')
          router.refresh()
        } else {
          await createTeamMember(input)
          toast.success('Сохранено')
          router.push('/admin/team')
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Ошибка')
      }
    })
  })

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-xl">
      <div>
        <Label htmlFor="name">Имя *</Label>
        <Input id="name" {...register('name')} disabled={isPending} />
        {errors.name && <p className="text-destructive text-sm mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <Label htmlFor="photoUrl">Фото (URL) *</Label>
        <Input id="photoUrl" type="url" {...register('photoUrl')} disabled={isPending} />
        {errors.photoUrl && <p className="text-destructive text-sm mt-1">{errors.photoUrl.message}</p>}
      </div>

      <div>
        <Label htmlFor="education">Образование</Label>
        <Textarea id="education" {...register('education')} disabled={isPending} rows={3} />
        {errors.education && <p className="text-destructive text-sm mt-1">{errors.education.message}</p>}
      </div>

      <div>
        <Label htmlFor="achievements">Достижения</Label>
        <Textarea id="achievements" {...register('achievements')} disabled={isPending} rows={3} />
        {errors.achievements && <p className="text-destructive text-sm mt-1">{errors.achievements.message}</p>}
      </div>

      <div>
        <Label>Ссылки профиля</Label>
        <div className="space-y-2 mt-1">
          {fields.map((field, idx) => (
            <div key={field.id} className="flex gap-2">
              <Input type="url" {...register(`profileLinks.${idx}.value`)} disabled={isPending} />
              <Button type="button" variant="outline" size="sm" onClick={() => remove(idx)} disabled={isPending}>✕</Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => append({ value: '' })} disabled={isPending}>
            + Добавить ссылку
          </Button>
        </div>
      </div>

      <div>
        <Label htmlFor="sortOrder">Порядок сортировки *</Label>
        <Input id="sortOrder" type="number" min="0" {...register('sortOrder')} disabled={isPending} className="max-w-[140px]" />
        {errors.sortOrder && <p className="text-destructive text-sm mt-1">{errors.sortOrder.message}</p>}
      </div>

      <Button type="submit" disabled={isPending}>Сохранить</Button>
    </form>
  )
}
