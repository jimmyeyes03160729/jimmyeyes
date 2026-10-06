import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../app/App'

afterEach(() => { cleanup(); localStorage.clear() })

describe('initial access gate', () => {
  it('shows Google sign-in first and renders no private dashboard before data is imported', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /使用 Google 帳號登入/ })).toBeInTheDocument()
    expect(screen.queryByText('工程戰情室')).not.toBeInTheDocument()
    expect(screen.queryByText('尚未載入私人 EasyStock 資料')).not.toBeInTheDocument()
  })
})
