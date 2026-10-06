import { FirebaseApp, deleteApp, initializeApp } from 'firebase/app'
import { Auth, GoogleAuthProvider, getAuth, signInWithPopup, signOut } from 'firebase/auth'

export interface FirebaseWebConfig {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
  storageBucket?: string
  messagingSenderId?: string
}

const CONFIG_KEY = 'easystock-ops-firebase-config'
let app: FirebaseApp | undefined
let auth: Auth | undefined

export function getSavedFirebaseConfig(): FirebaseWebConfig | undefined {
  const raw = localStorage.getItem(CONFIG_KEY)
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as Partial<FirebaseWebConfig>
    if (parsed.apiKey && parsed.authDomain && parsed.projectId && parsed.appId) return parsed as FirebaseWebConfig
  } catch {
    localStorage.removeItem(CONFIG_KEY)
  }
  return undefined
}

export async function saveFirebaseConfig(config: FirebaseWebConfig): Promise<void> {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  if (app) await deleteApp(app)
  app = undefined
  auth = undefined
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    const config = getSavedFirebaseConfig()
    if (!config) throw new Error('請先設定 Firebase Web app。')
    app = initializeApp(config)
    auth = getAuth(app)
  }
  return auth
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider())
}

export async function logout(): Promise<void> {
  if (auth) await signOut(auth)
}
