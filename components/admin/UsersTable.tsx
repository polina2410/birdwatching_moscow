'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition, useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { changeUserRole, blockUser, unblockUser, getUserRoleHistory } from '@/app/admin/users/_actions'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { buttonVariants } from '@/components/ui/button'
import { useDebounce } from '@/lib/useDebounce'
import type { Role } from '@/generated/prisma/client'

type UserRow = {
  id: string
  name: string
  email: string
  role: Role
  createdAt: Date
  deletedAt: Date | null
  blockedAt: Date | null
}

type HistoryEntry = {
  id: string
  fromRole: Role
  toRole: Role
  createdAt: Date
  changedByUser: { name: string; email: string }
}

const ROLE_LABELS: Record<Role, string> = {
  USER: 'Пользователь',
  ADMIN: 'Админ',
  SUPERADMIN: 'Суперадмин',
}

const ALL_ROLES: Role[] = ['USER', 'ADMIN', 'SUPERADMIN']

type Props = { users: UserRow[]; page: number; totalPages: number }

export const UsersTable = ({ users, page, totalPages }: Props) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [roleModal, setRoleModal] = useState<{ user: UserRow; newRole: Role } | null>(null)
  const [blockModal, setBlockModal] = useState<UserRow | null>(null)
  const [historyModal, setHistoryModal] = useState<{ user: UserRow; entries: HistoryEntry[] } | null>(null)

  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '')
  const debouncedSearch = useDebounce(searchInput, 400)
  const currentRole = searchParams.get('role') ?? ''
  const showDeleted = searchParams.get('showDeleted') === 'true'
  const showBlocked = searchParams.get('showBlocked') === 'true'

  const updateParam = (key: string, value: string) => {
    const sp = new URLSearchParams(searchParams.toString())
    if (value) sp.set(key, value); else sp.delete(key)
    sp.delete('page')
    router.push(`${pathname}?${sp.toString()}`)
  }

  const prevSearch = searchParams.get('search') ?? ''
  if (debouncedSearch !== prevSearch) updateParam('search', debouncedSearch)

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

  const openHistory = async (user: UserRow) => {
    try {
      const entries = await getUserRoleHistory(user.id)
      setHistoryModal({ user, entries })
    } catch {
      toast.error('Ошибка загрузки истории')
    }
  }

  const goPage = (p: number) => {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('page', String(p))
    router.push(`${pathname}?${sp.toString()}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Поиск по имени или email..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-xs"
        />
        <Select value={currentRole || 'ALL'} onValueChange={(v) => updateParam('role', v == null || v === 'ALL' ? '' : v)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все роли</SelectItem>
            {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={showDeleted} onChange={(e) => updateParam('showDeleted', e.target.checked ? 'true' : '')} />
          Показать удалённых
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={showBlocked} onChange={(e) => updateParam('showBlocked', e.target.checked ? 'true' : '')} />
          Показать заблокированных
        </label>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Имя</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Роль</TableHead>
            <TableHead>Дата регистрации</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Нет пользователей</TableCell></TableRow>
          )}
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.name}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                <Badge variant={u.role === 'SUPERADMIN' ? 'default' : 'secondary'}>{ROLE_LABELS[u.role]}</Badge>
              </TableCell>
              <TableCell>{format(new Date(u.createdAt), 'd MMM yyyy', { locale: ru })}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {u.deletedAt && <Badge variant="destructive" className="text-xs">Удалён</Badge>}
                  {u.blockedAt && <Badge variant="outline" className="text-xs">Заблокирован</Badge>}
                </div>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                    •••
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!u.deletedAt && (
                      <DropdownMenuItem
                        onClick={() => {
                          const initial: Role = u.role === 'USER' ? 'ADMIN' : u.role === 'ADMIN' ? 'SUPERADMIN' : 'ADMIN'
                          setRoleModal({ user: u, newRole: initial })
                        }}
                      >
                        Изменить роль
                      </DropdownMenuItem>
                    )}
                    {!u.blockedAt && (
                      <DropdownMenuItem onClick={() => setBlockModal(u)}>
                        Заблокировать
                      </DropdownMenuItem>
                    )}
                    {u.blockedAt && (
                      <DropdownMenuItem onClick={() => act(() => unblockUser(u.id), 'Блокировка снята')}>
                        Разблокировать
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => openHistory(u)}>История ролей</DropdownMenuItem>
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
            <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" onClick={() => goPage(p)}>{p}</Button>
          ))}
        </div>
      )}

      {/* Change role modal */}
      <Dialog open={!!roleModal} onOpenChange={(o) => !o && setRoleModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Изменить роль</DialogTitle></DialogHeader>
          {roleModal && (
            <>
              <p className="text-sm">Пользователь: <strong>{roleModal.user.name}</strong> ({roleModal.user.email})</p>
              <p className="text-sm">Текущая роль: <strong>{ROLE_LABELS[roleModal.user.role]}</strong></p>
              <Select value={roleModal.newRole} onValueChange={(v) => v && setRoleModal({ ...roleModal, newRole: v as Role })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRoleModal(null)}>Отмена</Button>
                <Button
                  disabled={isPending || roleModal.newRole === roleModal.user.role}
                  onClick={() => {
                    const { user, newRole } = roleModal
                    setRoleModal(null)
                    act(() => changeUserRole(user.id, newRole), 'Роль изменена')
                  }}
                >
                  Подтвердить
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Block user modal */}
      <Dialog open={!!blockModal} onOpenChange={(o) => !o && setBlockModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Заблокировать пользователя?</DialogTitle></DialogHeader>
          {blockModal && (
            <>
              <p>Заблокировать <strong>{blockModal.name}</strong>? Он не сможет войти в систему.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBlockModal(null)}>Отмена</Button>
                <Button
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => {
                    const user = blockModal
                    setBlockModal(null)
                    act(() => blockUser(user.id), 'Заблокировано')
                  }}
                >
                  Заблокировать
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Role history modal */}
      <Dialog open={!!historyModal} onOpenChange={(o) => !o && setHistoryModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>История ролей — {historyModal?.user.name}</DialogTitle>
          </DialogHeader>
          {historyModal?.entries.length === 0 ? (
            <p className="text-muted-foreground text-sm">Изменений роли пока не было.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {historyModal?.entries.map((e) => (
                <div key={e.id} className="border-b pb-2">
                  <span className="text-muted-foreground">{format(new Date(e.createdAt), 'd MMM yyyy, HH:mm', { locale: ru })}</span>
                  {' — '}
                  <strong>{e.changedByUser.name}</strong> изменил роль с{' '}
                  <Badge variant="outline" className="text-xs">{ROLE_LABELS[e.fromRole]}</Badge>
                  {' на '}
                  <Badge variant="outline" className="text-xs">{ROLE_LABELS[e.toRole]}</Badge>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}