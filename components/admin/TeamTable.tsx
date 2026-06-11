'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { deleteTeamMember } from '@/app/admin/team/_actions'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type MemberRow = {
  id: string
  name: string
  photoUrl: string
  sortOrder: number
  _count: { events: number }
}

export const TeamTable = ({ members }: { members: MemberRow[] }) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deleteTarget, setDeleteTarget] = useState<MemberRow | null>(null)

  const handleDelete = (member: MemberRow) => {
    setDeleteTarget(null)
    startTransition(async () => {
      try {
        await deleteTeamMember(member.id)
        toast.success('Удалено')
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Ошибка')
      }
    })
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Фото</TableHead>
            <TableHead>Имя</TableHead>
            <TableHead>Порядок</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                Нет участников
              </TableCell>
            </TableRow>
          )}
          {members.map((m) => (
            <TableRow key={m.id}>
              <TableCell>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.photoUrl} alt={m.name} className="w-10 h-10 rounded-full object-cover" />
              </TableCell>
              <TableCell className="font-medium">{m.name}</TableCell>
              <TableCell>{m.sortOrder}</TableCell>
              <TableCell>
                <div className="flex gap-2 justify-end">
                  <Link href={`/admin/team/${m.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    Изменить
                  </Link>
                  {m._count.events > 0 ? (
                    <Tooltip>
                      <TooltipTrigger render={<span className="inline-block" />}>
                        <Button variant="destructive" size="sm" disabled>Удалить</Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Этот участник назначен гидом на {m._count.events} событий. Сначала снимите его с событий.
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(m)} disabled={isPending}>
                      Удалить
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить участника?</DialogTitle>
          </DialogHeader>
          <p>«{deleteTarget?.name}» будет удалён без возможности восстановления.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Отмена</Button>
            <Button variant="destructive" disabled={isPending} onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
