import type { EasyStockPrivateData } from '../types/easystock'

export interface SearchResult { title: string; section: string; excerpt: string }

export function searchPrivateData(data: EasyStockPrivateData, query: string): SearchResult[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return []
  const results: SearchResult[] = []
  const walk = (value: unknown, section: string, path: string) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, section, `${path}[${index}]`))
    } else if (typeof value === 'string') {
      if (value.toLocaleLowerCase().includes(needle)) results.push({ title: path, section, excerpt: value.slice(0, 180) })
    } else if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>
      const text = Object.values(record).filter((item) => typeof item === 'string').join(' ')
      if (text.toLocaleLowerCase().includes(needle)) {
        results.push({ title: String(record.title ?? record.name ?? record.label ?? path), section, excerpt: text.slice(0, 180) })
      }
      Object.entries(record).forEach(([key, child]) => {
        if (child && typeof child === 'object') walk(child, section, path ? `${path}.${key}` : key)
      })
    }
  }
  Object.entries(data).forEach(([section, value]) => walk(value, section, section))
  return results
}
