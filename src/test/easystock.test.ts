import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import example from '../../example-private-data.json'
import { clearPrivateData, exportPrivateJson, loadPrivateData, parsePrivateJson, readPrivateJsonFile, savePrivateData } from '../lib/storage'
import { copyCommand, removeAt, reorder, replaceAt } from '../lib/data-actions'
import { searchPrivateData } from '../lib/search'
import { canAccessPrivateData, canRenderPrivateContent } from '../app/App'
import { validatePrivateData } from '../types/easystock'

const validData = example as unknown as Parameters<typeof savePrivateData>[0]

describe('private-data schema and import/export', () => {
  it('accepts the example schema and rejects incomplete JSON', () => {
    expect(validatePrivateData(example)).toBe(true)
    expect(validatePrivateData({ meta: {} })).toBe(false)
  })

  it('parses JSON and reports malformed or invalid schema', () => {
    expect(parsePrivateJson(JSON.stringify(example)).meta.schemaVersion).toBe(1)
    expect(() => parsePrivateJson('{')).toThrow('無法解析 JSON')
    expect(() => parsePrivateJson('{"meta":{}}')).toThrow('schema')
  })

  it('exports valid JSON that can be imported again', () => {
    expect(parsePrivateJson(exportPrivateJson(validData))).toEqual(validData)
  })

  it('imports a selected JSON file using the browser file reader', async () => {
    const file = new File([JSON.stringify(example)], 'private-data.json', { type: 'application/json' })
    await expect(readPrivateJsonFile(file)).resolves.toMatchObject({ meta: { schemaVersion: 1 } })
  })
})

describe('IndexedDB local persistence', () => {
  beforeEach(async () => { await clearPrivateData() })

  it('saves, reloads, and clears data locally', async () => {
    expect(await loadPrivateData()).toBeUndefined()
    await savePrivateData(validData)
    expect((await loadPrivateData())?.owner.displayName).toBe('Example Owner')
    await clearPrivateData()
    expect(await loadPrivateData()).toBeUndefined()
  })
})

describe('access and local editing actions', () => {
  it('allows only the configured Google email, case-insensitively', () => {
    expect(canAccessPrivateData('jimmyeyes0316@gmail.com')).toBe(true)
    expect(canAccessPrivateData('JIMMYEYES0316@gmail.com')).toBe(true)
    expect(canAccessPrivateData('other@example.com')).toBe(false)
    expect(canAccessPrivateData(null)).toBe(false)
  })

  it('does not allow private content to render without both the allowed account and imported data', () => {
    expect(canRenderPrivateContent('jimmyeyes0316@gmail.com', undefined)).toBe(false)
    expect(canRenderPrivateContent('other@example.com', validData)).toBe(false)
    expect(canRenderPrivateContent('jimmyeyes0316@gmail.com', validData)).toBe(true)
  })

  it('supports edit, delete, and ordering actions', () => {
    expect(replaceAt(['a', 'b'], 1, 'edited')).toEqual(['a', 'edited'])
    expect(removeAt(['a', 'b'], 0)).toEqual(['b'])
    expect(reorder(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
  })

  it('finds matching private content globally', () => {
    expect(searchPrivateData(validData, 'premarket').some((result) => result.section === 'intraday')).toBe(true)
    expect(searchPrivateData(validData, '').length).toBe(0)
  })

  it('copies a command to the provided clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    await copyCommand('git status --short', { writeText } as unknown as Clipboard)
    expect(writeText).toHaveBeenCalledWith('git status --short')
  })
})
