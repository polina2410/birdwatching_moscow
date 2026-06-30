# Current Feature: django-admin-crud

## Status
In Progress

## Goals

- Walk CRUD: create/edit/delete with auto UUID, auto slug from title, auto `createdAt`; publish/cancel/restore bulk actions that set `status`, `publishedAt`, `publishedBy`
- Expedition CRUD: create/edit/delete with auto UUID, auto slug, auto `createdAt`; `ExpeditionDay` managed as inline; publish/cancel/restore bulk actions
- TeamMember CRUD: create/edit/delete with `profileLinks` array field handled via comma-separated text input
- Request: add `toggle_status` bulk action (NEW ↔ WAITLIST); keep add/delete disabled
- No Next.js admin pages to remove — already deleted in walk-expedition-split

## Notes

<!-- Notes are populated when a feature is loaded -->

**Spec:** 
