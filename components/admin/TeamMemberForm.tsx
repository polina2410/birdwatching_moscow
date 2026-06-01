'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { createTeamMember, updateTeamMember } from '@/app/admin/team/_actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { TeamMember } from '@/generated/prisma/client'

type FormValues = {
  name: string
  photoUrl: string
  education: string
  achievements: string
  profileLinks: { value: string }[]
  sortOrder: string
}

export const TeamMemberForm = ({ member }: { member?: TeamMember }) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, control } = useForm<FormValues>({
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
          const id = await createTeamMember(input)
          toast.success('Сохранено')
          router.push(`/admin/team/${id}`)
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
        <Input id="name" {...register('name', { required: true })} disabled={isPending} />
      </div>

      <div>
        <Label htmlFor="photoUrl">Фото (URL) *</Label>
        <Input id="photoUrl" type="url" {...register('photoUrl', { required: true })} disabled={isPending} />
      </div>

      <div>
        <Label htmlFor="education">Образование</Label>
        <Textarea id="education" {...register('education')} disabled={isPending} rows={3} />
      </div>

      <div>
        <Label htmlFor="achievements">Достижения</Label>
        <Textarea id="achievements" {...register('achievements')} disabled={isPending} rows={3} />
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
        <Input id="sortOrder" type="number" min="0" {...register('sortOrder', { required: true })} disabled={isPending} className="max-w-[140px]" />
      </div>

      <Button type="submit" disabled={isPending}>Сохранить</Button>
    </form>
  )
}