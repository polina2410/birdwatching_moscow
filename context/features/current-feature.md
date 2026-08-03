# Current Feature: nextjs-admin

## Status
Not Started

## Goals

- Schema migrations: `galleryUrl String?` added to `Walk`, `galleryUrls String[]` added to `Expedition`
- Django proxy rewrite removed from `next.config.ts`; `/admin` exclusion removed from `middleware.ts`
- Middleware role-gates `/admin/*`: unauthenticated → `/login?returnUrl=...`, USER → `/`, ADMIN on `/admin/users` → `/admin/walks?error=superadmin_required`
- Admin shell: `app/admin/layout.tsx` with sidebar (Прогулки, Экспедиции, Команда, Заявки, Пользователи — last item SUPERADMIN-only), `app/admin/page.tsx` redirects to `/admin/walks`
- Walks section: list (filters, pagination), create form, edit form, Server Actions with full lifecycle (publish/cancel/restore/delete) and ticket-aware delete guard
- Expeditions section: list, create form (with repeatable days, multi-guide, gallery URLs up to 5), edit form, Server Actions with lifecycle and request-aware delete guard
- Team section: list, create/edit forms, Server Actions with guide-assignment delete guard
- Requests section: list (filters, detail modal), Server Action for NEW ↔ WAITLIST toggle
- Users section (SUPERADMIN only): list (filters, role history modal), Server Actions for changeUserRole (transactional + RoleChangeLog), blockUser, unblockUser
- `ensureUniqueSlug` utility in `lib/admin/slug.ts` with collision retry
- Homepage "Админка" link updated from `/admin/` to `/admin/walks`
- `pnpm test:run` green, `pnpm build` zero TS errors

## Notes

**Spec:** context/specs/nextjs-admin/spec.md
