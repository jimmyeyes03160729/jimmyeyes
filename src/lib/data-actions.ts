export function replaceAt<T>(items: T[], index: number, value: T): T[] {
  if (index < 0 || index >= items.length) return items
  return items.map((item, itemIndex) => itemIndex === index ? value : item)
}

export function removeAt<T>(items: T[], index: number): T[] {
  return items.filter((_, itemIndex) => itemIndex !== index)
}

export function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return [...items]
  const result = [...items]
  const [item] = result.splice(from, 1)
  result.splice(to, 0, item)
  return result
}

export async function copyCommand(command: string, clipboard?: Pick<Clipboard, 'writeText'>): Promise<void> {
  const target = clipboard ?? navigator.clipboard
  if (!target) throw new Error('此瀏覽器不支援剪貼簿 API')
  await target.writeText(command)
}
