import { openDB } from 'idb'
import type { EasyStockPrivateData } from '../types/easystock'
import { assertPrivateData } from '../types/easystock'

const DB_NAME = 'easystock-ops-private'
const STORE = 'private-data'
const KEY = 'primary'

function database() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    },
  })
}

export async function loadPrivateData(): Promise<EasyStockPrivateData | undefined> {
  const db = await database()
  const value = await db.get(STORE, KEY)
  return value === undefined ? undefined : assertPrivateData(value)
}

export async function savePrivateData(data: EasyStockPrivateData): Promise<void> {
  assertPrivateData(data)
  const db = await database()
  await db.put(STORE, structuredClone(data), KEY)
}

export async function clearPrivateData(): Promise<void> {
  const db = await database()
  await db.delete(STORE, KEY)
}

export function parsePrivateJson(text: string): EasyStockPrivateData {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('無法解析 JSON，請確認檔案內容。')
  }
  return assertPrivateData(parsed)
}

export function readPrivateJsonFile(file: File): Promise<EasyStockPrivateData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('無法讀取選取的 JSON 檔案。'))
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('JSON 檔案內容不是有效文字。'))
        return
      }
      try { resolve(parsePrivateJson(reader.result)) }
      catch (cause) { reject(cause) }
    }
    reader.readAsText(file)
  })
}

export function exportPrivateJson(data: EasyStockPrivateData): string {
  return JSON.stringify(assertPrivateData(data), null, 2)
}
