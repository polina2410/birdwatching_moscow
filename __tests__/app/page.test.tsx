import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from '@/app/page'

describe('Home page', () => {
  it('renders without errors', async () => {
    render(await Home())
    expect(screen.getByRole('main')).toBeDefined()
  })
})
