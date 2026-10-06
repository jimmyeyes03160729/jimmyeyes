import { beforeEach, describe, expect, it, vi } from 'vitest'

const { signOut, fakeAuth } = vi.hoisted(() => ({ signOut: vi.fn().mockResolvedValue(undefined), fakeAuth: { currentUser: null } }))

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})), deleteApp: vi.fn() }))
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => fakeAuth), GoogleAuthProvider: class {}, signInWithPopup: vi.fn(), signOut }))

import { getFirebaseAuth, logout, saveFirebaseConfig } from '../lib/firebase'

describe('Firebase logout', () => {
  beforeEach(() => { localStorage.clear(); signOut.mockClear() })

  it('signs out the initialized Firebase user', async () => {
    await saveFirebaseConfig({ apiKey: 'runtime-test', authDomain: 'test.invalid', projectId: 'test', appId: 'test-app' })
    getFirebaseAuth()
    await logout()
    expect(signOut).toHaveBeenCalledWith(fakeAuth)
  })
})
