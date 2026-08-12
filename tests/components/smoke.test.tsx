import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('jsdom harness', () => {
  it('renders and queries a component', () => {
    render(<p>hello</p>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })
})
