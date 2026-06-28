import { describe, it, expect } from 'vitest'
import { Prisma, $Enums } from '@/generated/prisma/client'

// All tests in this file check the Prisma generated client's runtime metadata.
// No DB connection required — Prisma.ModelName and *ScalarFieldEnum are plain objects.
// Every test here must be RED until:
//   1. prisma/schema.prisma is updated (Walk + Expedition models, remove Event)
//   2. `prisma generate` is re-run

describe('new models are registered in Prisma client', () => {
  it('Walk is a registered model', () => {
    expect(Prisma.ModelName.Walk).toBe('Walk')
  })

  it('Expedition is a registered model', () => {
    expect(Prisma.ModelName.Expedition).toBe('Expedition')
  })
})

describe('Event model is removed from Prisma client', () => {
  it('Event is no longer a registered model', () => {
    expect((Prisma.ModelName as Record<string, unknown>).Event).toBeUndefined()
  })

  it('EventType enum is removed from generated enums', () => {
    expect(($Enums as Record<string, unknown>).EventType).toBeUndefined()
  })
})

describe('Walk scalar fields', () => {
  const Walk = (Prisma as Record<string, unknown>).WalkScalarFieldEnum as Record<string, unknown> | undefined

  it('WalkScalarFieldEnum exists', () => {
    expect(Walk).toBeDefined()
  })

  it('Walk has priceKopecks (required, not nullable)', () => {
    expect(Walk?.priceKopecks).toBe('priceKopecks')
  })

  it('Walk has capacity (required, not nullable)', () => {
    expect(Walk?.capacity).toBe('capacity')
  })

  it('Walk has guideId (single-guide FK)', () => {
    expect(Walk?.guideId).toBe('guideId')
  })

  it('Walk does not have totalSpots (expedition-only field)', () => {
    expect(Walk?.totalSpots).toBeUndefined()
  })

  it('Walk does not have spotsLeft (expedition-only field)', () => {
    expect(Walk?.spotsLeft).toBeUndefined()
  })
})

describe('Expedition scalar fields', () => {
  const Expedition = (Prisma as Record<string, unknown>).ExpeditionScalarFieldEnum as Record<string, unknown> | undefined

  it('ExpeditionScalarFieldEnum exists', () => {
    expect(Expedition).toBeDefined()
  })

  it('Expedition has totalSpots (required)', () => {
    expect(Expedition?.totalSpots).toBe('totalSpots')
  })

  it('Expedition has spotsLeft (required)', () => {
    expect(Expedition?.spotsLeft).toBe('spotsLeft')
  })

  it('Expedition does not have priceKopecks (walk-only field)', () => {
    expect(Expedition?.priceKopecks).toBeUndefined()
  })

  it('Expedition does not have guideId (walk uses single FK; expedition uses M2M)', () => {
    expect(Expedition?.guideId).toBeUndefined()
  })
})

describe('Ticket FK rename: eventId → walkId', () => {
  it('Ticket has walkId field', () => {
    expect((Prisma.TicketScalarFieldEnum as Record<string, unknown>).walkId).toBe('walkId')
  })

  it('Ticket does not have eventId field', () => {
    expect((Prisma.TicketScalarFieldEnum as Record<string, unknown>).eventId).toBeUndefined()
  })
})

describe('CartItem FK rename: eventId → walkId', () => {
  it('CartItem has walkId field', () => {
    expect((Prisma.CartItemScalarFieldEnum as Record<string, unknown>).walkId).toBe('walkId')
  })

  it('CartItem does not have eventId field', () => {
    expect((Prisma.CartItemScalarFieldEnum as Record<string, unknown>).eventId).toBeUndefined()
  })
})

describe('ExpeditionDay FK rename: eventId → expeditionId', () => {
  it('ExpeditionDay has expeditionId field', () => {
    expect((Prisma.ExpeditionDayScalarFieldEnum as Record<string, unknown>).expeditionId).toBe('expeditionId')
  })

  it('ExpeditionDay does not have eventId field', () => {
    expect((Prisma.ExpeditionDayScalarFieldEnum as Record<string, unknown>).eventId).toBeUndefined()
  })
})

describe('Request FK rename: eventId → expeditionId', () => {
  it('Request has expeditionId field', () => {
    expect((Prisma.RequestScalarFieldEnum as Record<string, unknown>).expeditionId).toBe('expeditionId')
  })

  it('Request does not have eventId field', () => {
    expect((Prisma.RequestScalarFieldEnum as Record<string, unknown>).eventId).toBeUndefined()
  })
})
