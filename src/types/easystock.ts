export type Status = 'ACTIVE' | 'IN DEVELOPMENT' | 'RESEARCH' | 'PLANNED' | 'DEPRECATED' | 'ISSUE'
export type WorkStatus = 'DOING' | 'NEXT' | 'BACKLOG' | 'BLOCKED' | 'DONE'
export type RoadmapLane = 'Now' | 'Next' | 'Later' | 'Research' | 'Done'
export type DangerLevel = 'READ_ONLY' | 'SAFE' | 'WRITE' | 'DANGEROUS' | 'DELETE'

export interface Connection {
  name: string
  type: string
  host?: string
  port?: string | number
  username?: string
  url?: string
  command?: string
  description?: string
  notes?: string
  status: Status
}

export interface ServiceRecord {
  name: string
  status: Status
  description?: string
  owner?: string
  notes?: string
}

export interface ApiRecord {
  name: string
  category: '行情' | '交易' | '研究' | '平台' | string
  purpose: string
  production: boolean
  marketData: boolean
  trading: boolean
  historicalData: boolean
  realtime: boolean
  limits?: string
  status: Status
  notes?: string
}

export interface WorkItem {
  title: string
  area: string
  priority: 'P0' | 'P1' | 'P2' | 'P3' | string
  status: WorkStatus
  description?: string
  created?: string
  updated?: string
  dependency?: string
  notes?: string
}

export interface RoadmapItem {
  title: string
  area: string
  lane: RoadmapLane
  description?: string
}

export interface CommandRecord {
  title: string
  category: string
  command: string
  description?: string
  danger: DangerLevel
}

export interface ChangeRecord {
  date: string
  title: string
  description: string
  area: string
  version?: string
  commit?: string
  status: string
}

export interface ArchitectureNode {
  id: string
  label: string
  description: string
  status?: Status
  children?: ArchitectureNode[]
}

export interface EasyStockPrivateData {
  meta: { schemaVersion: number; updatedAt: string; title?: string }
  owner: { displayName: string; email?: string }
  infrastructure: { systems: ServiceRecord[]; diagram: ArchitectureNode[]; notes?: string }
  nasAIEnvironment: { workflow: ArchitectureNode[]; notes?: string }
  connections: Connection[]
  services: ServiceRecord[]
  docker: Array<{ name: string; ramLimit?: string; role?: string; persistent?: boolean; repoMount?: string; status: Status; notes?: string }>
  apis: ApiRecord[]
  architecture: { nodes: ArchitectureNode[]; dataFlow: ArchitectureNode[]; notes?: string }
  intraday: Record<string, unknown>
  marketRisk: Record<string, unknown>
  paperTrading: Record<string, unknown>
  reboundAI: Record<string, unknown>
  historicalLearning: Record<string, unknown>
  research: Record<string, unknown>
  chromeExtension: Record<string, unknown>
  backup: Array<Record<string, unknown>>
  currentWork: WorkItem[]
  roadmap: RoadmapItem[]
  commands: CommandRecord[]
  changelog: ChangeRecord[]
  notes: Array<{ title: string; content: string; area?: string; updated?: string }>
  [key: string]: unknown
}

export const REQUIRED_SECTIONS = [
  'meta', 'owner', 'infrastructure', 'nasAIEnvironment', 'connections', 'services', 'docker', 'apis',
  'architecture', 'intraday', 'marketRisk', 'paperTrading', 'reboundAI',
  'historicalLearning', 'research', 'chromeExtension', 'backup', 'currentWork',
  'roadmap', 'commands', 'changelog', 'notes',
] as const

export function validatePrivateData(value: unknown): value is EasyStockPrivateData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const data = value as Record<string, unknown>
  if (!REQUIRED_SECTIONS.every((section) => section in data)) return false
  const isRecord = (entry: unknown): entry is Record<string, unknown> => !!entry && typeof entry === 'object' && !Array.isArray(entry)
  if (!isRecord(data.meta) || typeof data.meta.schemaVersion !== 'number' || !Number.isInteger(data.meta.schemaVersion) || typeof data.meta.updatedAt !== 'string') return false
  if (!isRecord(data.owner) || typeof data.owner.displayName !== 'string') return false
  const arraySections = ['connections', 'services', 'docker', 'apis', 'backup', 'currentWork', 'roadmap', 'commands', 'changelog', 'notes']
  if (!arraySections.every((section) => Array.isArray(data[section]))) return false
  if (!isRecord(data.infrastructure) || !Array.isArray(data.infrastructure.systems) || !Array.isArray(data.infrastructure.diagram)) return false
  if (!isRecord(data.nasAIEnvironment) || !Array.isArray(data.nasAIEnvironment.workflow)) return false
  if (!isRecord(data.architecture) || !Array.isArray(data.architecture.nodes) || !Array.isArray(data.architecture.dataFlow)) return false
  const objectSections = ['intraday', 'marketRisk', 'paperTrading', 'reboundAI', 'historicalLearning', 'research', 'chromeExtension']
  if (!objectSections.every((section) => isRecord(data[section]))) return false
  for (const item of data.connections as unknown[]) {
    if (!isRecord(item) || typeof item.name !== 'string' || typeof item.type !== 'string' || typeof item.status !== 'string') return false
  }
  for (const item of data.commands as unknown[]) {
    if (!isRecord(item) || typeof item.title !== 'string' || typeof item.command !== 'string' || typeof item.category !== 'string' || typeof item.danger !== 'string') return false
  }
  for (const item of data.currentWork as unknown[]) {
    if (!isRecord(item) || typeof item.title !== 'string' || typeof item.area !== 'string' || typeof item.status !== 'string') return false
  }
  for (const item of data.roadmap as unknown[]) {
    if (!isRecord(item) || typeof item.title !== 'string' || typeof item.lane !== 'string') return false
  }
  return true
}

export function assertPrivateData(value: unknown): EasyStockPrivateData {
  if (!validatePrivateData(value)) throw new Error('JSON 格式不符合 EasyStock 私人資料 schema，請確認必要區段與欄位。')
  return value
}
