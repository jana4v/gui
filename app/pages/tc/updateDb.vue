<script setup lang="ts">
import type { CellSelectionOptions, ColDef } from 'ag-grid-community'
import type { ConditionRule, QueryBuilderMnemonic } from '@/components/tm/queryBuilderTypes'
import {
  colorSchemeDarkBlue,
  colorSchemeLightCold,
  ModuleRegistry,
  themeQuartz,
} from 'ag-grid-community'
import { AllEnterpriseModule } from 'ag-grid-enterprise'
import { AgGridVue } from 'ag-grid-vue3'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import MonacoConditionEditor from '@/components/tm/MonacoConditionEditor.vue'
import QueryBuilder from '@/components/tm/QueryBuilder.vue'
import { initMenu } from '@/composables/tc/SideNav'
import { useColorModeStore } from '~/stores/colorMode'

const props = withDefaults(defineProps<{ embedMode?: boolean }>(), {
  embedMode: false,
})

ModuleRegistry.registerModules([AllEnterpriseModule])

definePageMeta({ title: 'Telecommand - Update TC DB' })
const route = useRoute()
if (String(route.path || '').startsWith('/tc'))
  initMenu(1)

type ConditionEditorType = 'visualBuilder' | 'monacoEditor'
type ConditionTargetField = 'preCondition' | 'postCondition'

interface TCRow {
  _id: string
  cmdId: string
  cmdDesc: string
  subsystem: string
  preCondition: string
  postCondition: string
  postConditionDelay: number
  priority: number
  cmdType: string
  format: string
  dataCodeMapName: string
  dataCodeMap: Record<string, any>
  inhibited: boolean
  exclude_in_expected: boolean
  exclude_in_procedure: boolean
}

interface DataCodeMapEntry {
  label: string
  code: string
  value: string
}

const colorModeStore = useColorModeStore()
const { apiBase: gatewayBase } = useRuntimeConfig().public

const subsystems = ref<string[]>([])
const selectedSubsystems = ref<string[]>([])
const cmdTypeOptions = ref<string[]>([])
const formatOptions = ref<string[]>([])
const dataMapNames = ref<string[]>([])
const conditionMnemonics = ref<QueryBuilderMnemonic[]>([])

const loading = ref(false)
const saving = ref(false)
const quickFilter = ref('')
const saveMessage = ref<{ type: 'success' | 'error', text: string } | null>(null)

const rowData = ref<TCRow[]>([])
const gridApi = ref<any>(null)
const changedIds = ref<Set<string>>(new Set())
const cellSelection = ref<boolean | CellSelectionOptions>({
  handle: { mode: 'fill' },
})

const showConditionEditor = ref(false)
const conditionTargetField = ref<ConditionTargetField>('preCondition')
const conditionRowId = ref('')
const conditionDraft = ref('')
const conditionRule = ref<ConditionRule | null>(null)
const conditionType = ref<ConditionEditorType>('visualBuilder')
let conditionSyncing = false

const showDataCodeMapEditor = ref(false)
const dataCodeMapRowId = ref('')
const dataCodeMapRows = ref<DataCodeMapEntry[]>([])
const dataCodeMapGridApi = ref<any>(null)

const gridTheme = computed(() =>
  colorModeStore.currentMode === 'dark'
    ? themeQuartz.withPart(colorSchemeDarkBlue)
    : themeQuartz.withPart(colorSchemeLightCold),
)

const conditionSubsystemOptions = computed(() => {
  const values = Array.from(new Set(selectedSubsystems.value.filter(Boolean)))
  return values.length > 0 ? values : subsystems.value
})
const conditionSubsystems = ref<string[]>([])

function isDataCommand(row?: TCRow | null): boolean {
  return String(row?.cmdType ?? '').trim().toLowerCase() === 'data'
}

function canEditDataFields(row?: TCRow | null): boolean {
  return isDataCommand(row)
}

function canEditNonDataFields(row?: TCRow | null): boolean {
  return !isDataCommand(row)
}

const columnDefs = ref<ColDef<TCRow>[]>([
  { headerName: 'CID', field: 'cmdId', minWidth: 130, maxWidth: 170, pinned: 'left', editable: false, suppressFillHandle: true },
  { headerName: 'Mnemonic', field: 'cmdDesc', minWidth: 260, editable: false, suppressFillHandle: true, cellStyle: { fontWeight: '600' } },
  {
    headerName: 'preCondition',
    field: 'preCondition',
    minWidth: 230,
    editable: p => canEditNonDataFields(p.data),
    cellClass: p => (canEditNonDataFields(p.data) ? 'condition-cell' : 'readonly-cell'),
    valueFormatter: p => formatConditionCell(p.value),
  },
  {
    headerName: 'postCondition',
    field: 'postCondition',
    minWidth: 230,
    editable: p => canEditNonDataFields(p.data),
    cellClass: p => (canEditNonDataFields(p.data) ? 'condition-cell' : 'readonly-cell'),
    valueFormatter: p => formatConditionCell(p.value),
  },
  {
    headerName: 'postConditionDelay',
    field: 'postConditionDelay',
    minWidth: 170,
    editable: p => canEditNonDataFields(p.data),
    valueParser: p => parseIntSafe(p.newValue, 0),
  },
  {
    headerName: 'priority',
    field: 'priority',
    minWidth: 120,
    editable: p => canEditNonDataFields(p.data),
    valueParser: p => parseIntSafe(p.newValue, 0),
  },
  {
    headerName: 'cmdType',
    field: 'cmdType',
    minWidth: 140,
    editable: true,
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: () => ({ values: withCurrentOption(cmdTypeOptions.value, rowData.value.map(r => r.cmdType)) }),
  },
  {
    headerName: 'format',
    field: 'format',
    minWidth: 130,
    editable: p => canEditNonDataFields(p.data),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: () => ({ values: withCurrentOption(formatOptions.value, rowData.value.map(r => r.format)) }),
  },
  {
    headerName: 'dataCodeMapName',
    field: 'dataCodeMapName',
    minWidth: 170,
    editable: p => canEditDataFields(p.data),
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: () => ({ values: withCurrentOption(dataMapNames.value, rowData.value.map(r => r.dataCodeMapName)) }),
  },
  {
    headerName: 'dataCodeMap',
    field: 'dataCodeMap',
    minWidth: 160,
    editable: p => canEditDataFields(p.data),
    cellClass: p => (canEditDataFields(p.data) ? 'condition-cell' : 'readonly-cell'),
    valueFormatter: p => `${Object.keys((p.value || {}) as Record<string, any>).length} entries`,
  },
  {
    headerName: 'inhibited',
    field: 'inhibited',
    minWidth: 120,
    editable: p => canEditNonDataFields(p.data),
    cellRenderer: 'agCheckboxCellRenderer',
    cellEditor: 'agCheckboxCellEditor',
  },
  {
    headerName: 'exclude_in_expected',
    field: 'exclude_in_expected',
    minWidth: 180,
    editable: p => canEditNonDataFields(p.data),
    cellRenderer: 'agCheckboxCellRenderer',
    cellEditor: 'agCheckboxCellEditor',
  },
  {
    headerName: 'exclude_in_procedure',
    field: 'exclude_in_procedure',
    minWidth: 190,
    editable: p => canEditNonDataFields(p.data),
    cellRenderer: 'agCheckboxCellRenderer',
    cellEditor: 'agCheckboxCellEditor',
  },
])

const defaultColDef: ColDef<TCRow> = {
  sortable: true,
  filter: true,
  resizable: true,
}

const dataCodeMapColumnDefs = ref<ColDef<DataCodeMapEntry>[]>([
  { headerName: 'Label', field: 'label', editable: true, minWidth: 220 },
  { headerName: 'Code', field: 'code', editable: true, minWidth: 180 },
  { headerName: 'Value', field: 'value', editable: true, minWidth: 220 },
])

onMounted(async () => {
  await Promise.all([
    loadSubsystems(),
    loadCommandTypes(),
    loadCommandFormats(),
    loadDataMapNames(),
  ])
})

watch(quickFilter, (v) => {
  gridApi.value?.setGridOption('quickFilterText', v)
})

watch(selectedSubsystems, async (subs) => {
  if (subs.length === 0) {
    rowData.value = []
    changedIds.value.clear()
    return
  }
  await Promise.all([loadConditionMnemonics(subs), loadRows(subs)])
}, { deep: true })

watch(conditionRule, (rule) => {
  if (conditionSyncing || conditionType.value !== 'visualBuilder')
    return
  const generated = rule ? generateLogicFromRules(rule) : ''
  if (generated === conditionDraft.value)
    return
  conditionSyncing = true
  conditionDraft.value = generated
  conditionSyncing = false
}, { deep: true })

watch(conditionDraft, (logic) => {
  if (conditionSyncing || conditionType.value !== 'monacoEditor')
    return
  const parsed = parseLogicToRule(logic)
  if (!parsed)
    return
  conditionSyncing = true
  conditionRule.value = parsed
  conditionSyncing = false
})

function parseIntSafe(value: unknown, def: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : def
}

function withCurrentOption(base: string[], currentValues: string[]): string[] {
  const all = new Set(base)
  for (const v of currentValues) {
    const n = String(v || '').trim()
    if (n)
      all.add(n)
  }
  return Array.from(all)
}

function normalizeLogic(v: string): string {
  return String(v || '').replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim()
}

function formatConditionCell(value: unknown): string {
  const logic = normalizeLogic(String(value ?? ''))
  return logic || 'Double-click to edit'
}

async function loadSubsystems() {
  try {
    const res = await $fetch<{ subsystems: string[] }>(`${gatewayBase}/telecommand/subsystems`)
    subsystems.value = (res?.subsystems || []).filter(Boolean)
  }
  catch {
    subsystems.value = []
  }
}

async function loadCommandTypes() {
  try {
    const res = await $fetch<{ items: string[] }>(`${gatewayBase}/telecommand/options/cmd-types`)
    cmdTypeOptions.value = res?.items || []
  }
  catch {
    cmdTypeOptions.value = []
  }
}

async function loadCommandFormats() {
  try {
    const res = await $fetch<{ items: string[] }>(`${gatewayBase}/telecommand/options/formats`)
    formatOptions.value = res?.items || []
  }
  catch {
    formatOptions.value = []
  }
}

async function loadDataMapNames() {
  try {
    const res = await $fetch<{ items: string[] }>(`${gatewayBase}/telecommand/data-map-names`)
    dataMapNames.value = res?.items || []
  }
  catch {
    dataMapNames.value = []
  }
}

async function loadConditionMnemonics(targetSubsystems: string[]) {
  try {
    const responses = await Promise.all(
      targetSubsystems.map(sub => $fetch<any[]>(`${gatewayBase}/mnemonics/tm/${encodeURIComponent(sub)}`)),
    )
    const merged = responses.flatMap((rows, idx) => {
      const subsystem = targetSubsystems[idx] || ''
      return (rows || []).map((m) => {
        const pid = String(m._id ?? m.pid ?? '').trim()
        const mnemonic = String(m.cdbMnemonic ?? m.mnemonic ?? '').trim()
        const display = pid ? `${pid}_${mnemonic}` : mnemonic
        const limits = Array.isArray(m.limits) ? m.limits : []
        const minValue = Number.isFinite(Number(limits[0])) ? Number(limits[0]) : null
        const maxValue = Number.isFinite(Number(limits[1])) ? Number(limits[1]) : null
        return {
          mnemonic: display,
          type: String(m.type || 'ANALOG'),
          unit: String(m.unit || ''),
          subsystem,
          valueSuggestions: (Array.isArray(m.range) ? m.range : []).map((x: any) => String(x)),
          minValue,
          maxValue,
          defaultValue: minValue !== null ? String(minValue) : '',
        } as QueryBuilderMnemonic
      }).filter(x => x.mnemonic)
    })
    const dedup = new Map<string, QueryBuilderMnemonic>()
    for (const m of merged)
      dedup.set(m.mnemonic, m)
    conditionMnemonics.value = Array.from(dedup.values())
  }
  catch {
    conditionMnemonics.value = []
  }
}

function intToBool(v: unknown): boolean {
  return Number(v) === 1 || String(v).toLowerCase() === 'true'
}

async function loadRows(targetSubsystems: string[]) {
  loading.value = true
  saveMessage.value = null
  changedIds.value.clear()
  try {
    const res = await $fetch<{ items: any[] }>(`${gatewayBase}/telecommand/db/query`, {
      method: 'POST',
      body: { subsystems: targetSubsystems },
    })

    rowData.value = (res?.items || []).map((r: any) => ({
      _id: String(r._id ?? r.cmdId ?? ''),
      cmdId: String(r.cmdId ?? r._id ?? ''),
      cmdDesc: String(r.cmdDesc ?? ''),
      subsystem: String(r.subsystem ?? ''),
      preCondition: String(r.preCondition ?? ''),
      postCondition: String(r.postCondition ?? ''),
      postConditionDelay: parseIntSafe(r.postConditionDelay, 46),
      priority: parseIntSafe(r.priority, 0),
      cmdType: String(r.cmdType ?? 'normal'),
      format: String(r.format ?? 'send'),
      dataCodeMapName: String(r.dataCodeMapName ?? ''),
      dataCodeMap: typeof r.dataCodeMap === 'object' && r.dataCodeMap ? r.dataCodeMap : {},
      inhibited: intToBool(r.inhibited),
      exclude_in_expected: intToBool(r.exclude_in_expected),
      exclude_in_procedure: intToBool(r.exclude_in_procedure),
    }))

    await nextTick()
    gridApi.value?.autoSizeAllColumns()
  }
  catch (e: any) {
    saveMessage.value = { type: 'error', text: e?.data?.error ?? 'Failed to load TC records' }
    rowData.value = []
  }
  finally {
    loading.value = false
  }
}

function onGridReady(params: any) {
  gridApi.value = params.api
  params.api.setGridOption('quickFilterText', quickFilter.value)
}

function onCellValueChanged(params: any) {
  const id = String(params?.data?.cmdId || '')
  if (!id)
    return
  changedIds.value.add(id)
}

function onCellDoubleClicked(params: any) {
  const field = String(params?.colDef?.field || '')
  if (field === 'preCondition' || field === 'postCondition') {
    if (!canEditNonDataFields(params?.data as TCRow))
      return
    openConditionEditor(params.data as TCRow, field)
    return
  }
  if (field === 'dataCodeMap') {
    if (!canEditDataFields(params?.data as TCRow))
      return
    openDataCodeMapEditor(params.data as TCRow)
  }
}

function switchConditionType(newType: ConditionEditorType) {
  if (conditionType.value === newType)
    return
  if (newType === 'monacoEditor') {
    if (conditionRule.value)
      conditionDraft.value = generateLogicFromRules(conditionRule.value)
  }
  else {
    const parsed = parseLogicToRule(conditionDraft.value)
    if (parsed)
      conditionRule.value = parsed
  }
  conditionType.value = newType
}

function openConditionEditor(row: TCRow, field: ConditionTargetField) {
  conditionRowId.value = row.cmdId
  conditionTargetField.value = field
  conditionSubsystems.value = [row.subsystem]
  conditionDraft.value = field === 'preCondition' ? row.preCondition : row.postCondition
  conditionRule.value = parseLogicToRule(conditionDraft.value)
  conditionType.value = 'visualBuilder'
  showConditionEditor.value = true
}

function applyConditionEditor() {
  const row = rowData.value.find(r => r.cmdId === conditionRowId.value)
  if (!row)
    return

  const finalLogic = conditionType.value === 'visualBuilder' && conditionRule.value
    ? generateLogicFromRules(conditionRule.value)
    : conditionDraft.value

  if (conditionTargetField.value === 'preCondition')
    row.preCondition = normalizeLogic(finalLogic)
  else
    row.postCondition = normalizeLogic(finalLogic)

  changedIds.value.add(row.cmdId)
  showConditionEditor.value = false
}

function dataCodeMapToRows(value: Record<string, any>): DataCodeMapEntry[] {
  const rows: DataCodeMapEntry[] = []
  const map = value || {}
  for (const [label, raw] of Object.entries(map)) {
    if (raw && typeof raw === 'object') {
      rows.push({
        label,
        code: String((raw as any).code ?? ''),
        value: String((raw as any).value ?? ''),
      })
    }
    else {
      rows.push({
        label,
        code: '',
        value: String(raw ?? ''),
      })
    }
  }
  return rows
}

function rowsToDataCodeMap(rows: DataCodeMapEntry[]): Record<string, any> {
  const out: Record<string, any> = {}
  for (const row of rows) {
    const label = String(row.label || '').trim()
    if (!label)
      continue
    out[label] = {
      code: String(row.code || '').trim(),
      value: String(row.value || '').trim(),
    }
  }
  return out
}

function openDataCodeMapEditor(row: TCRow) {
  dataCodeMapRowId.value = row.cmdId
  dataCodeMapRows.value = dataCodeMapToRows(row.dataCodeMap)
  showDataCodeMapEditor.value = true
}

function onDataCodeMapGridReady(params: any) {
  dataCodeMapGridApi.value = params.api
}

function addDataCodeMapRow() {
  dataCodeMapRows.value = [...dataCodeMapRows.value, { label: '', code: '', value: '' }]
}

function deleteSelectedDataCodeMapRows() {
  const selected = dataCodeMapGridApi.value?.getSelectedRows?.() || []
  if (!selected.length)
    return
  const selectedSet = new Set(selected)
  dataCodeMapRows.value = dataCodeMapRows.value.filter(row => !selectedSet.has(row))
}

function applyDataCodeMapEditor() {
  const row = rowData.value.find(r => r.cmdId === dataCodeMapRowId.value)
  if (!row)
    return
  row.dataCodeMap = rowsToDataCodeMap(dataCodeMapRows.value)
  changedIds.value.add(row.cmdId)
  showDataCodeMapEditor.value = false
}

async function saveChanges() {
  if (changedIds.value.size === 0) {
    saveMessage.value = { type: 'success', text: 'No changes to save.' }
    return
  }

  saving.value = true
  saveMessage.value = null
  try {
    const items = rowData.value
      .filter(r => changedIds.value.has(r.cmdId))
      .map(r => ({
        cmdId: r.cmdId,
        preCondition: r.preCondition,
        postCondition: r.postCondition,
        postConditionDelay: r.postConditionDelay,
        priority: r.priority,
        cmdType: r.cmdType,
        format: r.format,
        dataCodeMapName: r.dataCodeMapName,
        dataCodeMap: r.dataCodeMap,
        inhibited: r.inhibited ? 1 : 0,
        exclude_in_expected: r.exclude_in_expected ? 1 : 0,
        exclude_in_procedure: r.exclude_in_procedure ? 1 : 0,
      }))

    const res = await $fetch<{ updated: number }>(`${gatewayBase}/telecommand/db/bulk`, {
      method: 'PUT',
      body: { items },
    })

    changedIds.value.clear()
    saveMessage.value = { type: 'success', text: `Saved ${res?.updated ?? items.length} TC record(s).` }
  }
  catch (e: any) {
    saveMessage.value = { type: 'error', text: e?.data?.error ?? 'Failed to save TC updates' }
  }
  finally {
    saving.value = false
  }
}

// ---- logic parser/generator from dynamic-limits flow ----
type LogicTokenType = 'LPAREN' | 'RPAREN' | 'AND' | 'OR' | 'NOT' | 'IDENT' | 'OP' | 'VALUE'
interface LogicToken { type: LogicTokenType, value: string }

function tokenizeLogic(input: string): LogicToken[] {
  const tokens: LogicToken[] = []
  let i = 0

  const push = (type: LogicTokenType, value: string) => tokens.push({ type, value })

  while (i < input.length) {
    const ch = input[i]
    if (!ch)
      break

    if (/\s/.test(ch)) {
      i += 1
      continue
    }

    const rest = input.slice(i)
    if (rest.startsWith('&&')) {
      push('AND', 'AND')
      i += 2
      continue
    }
    if (rest.startsWith('||')) {
      push('OR', 'OR')
      i += 2
      continue
    }
    if (rest.startsWith('===')) {
      push('OP', '==')
      i += 3
      continue
    }
    if (rest.startsWith('!==')) {
      push('OP', '!=')
      i += 3
      continue
    }

    if (rest.startsWith('==') || rest.startsWith('!=') || rest.startsWith('>=') || rest.startsWith('<=') || rest.startsWith('>') || rest.startsWith('<')) {
      const op = /^(==|!=|>=|<=|>|<)/.exec(rest)?.[1]
      if (op) {
        push('OP', op)
        i += op.length
        continue
      }
    }

    if (ch === '(') {
      push('LPAREN', ch)
      i += 1
      continue
    }
    if (ch === ')') {
      push('RPAREN', ch)
      i += 1
      continue
    }
    if (ch === '!') {
      push('NOT', '!')
      i += 1
      continue
    }

    if (ch === '\'' || ch === '"') {
      const quote = ch
      let value = ''
      i += 1
      while (i < input.length) {
        const curr = input[i]
        if (!curr)
          break
        if (curr === '\\' && i + 1 < input.length) {
          value += input[i + 1] || ''
          i += 2
          continue
        }
        if (curr === quote) {
          i += 1
          break
        }
        value += curr
        i += 1
      }
      push('VALUE', value)
      continue
    }

    const word = /^[\w:.+-]+/.exec(rest)?.[0]
    if (word) {
      const upper = word.toUpperCase()
      if (upper === 'AND')
        push('AND', 'AND')
      else if (upper === 'OR')
        push('OR', 'OR')
      else if (upper === 'NOT')
        push('NOT', 'NOT')
      else if (/^-?\d+(?:\.\d+)?$/.test(word))
        push('VALUE', word)
      else
        push('IDENT', word)
      i += word.length
      continue
    }

    return []
  }

  return tokens
}

function parseLogicToRule(logic: string): ConditionRule | null {
  const tokens = tokenizeLogic(logic)
  if (!tokens.length)
    return null

  let index = 0
  let idCounter = 0
  const nextId = (prefix: 'rule' | 'group') => `${prefix}_parsed_${Date.now()}_${idCounter++}`
  const peek = () => tokens[index]
  const consume = () => tokens[index++]

  const parseRule = (): ConditionRule | null => {
    const mnemonic = consume()
    const operator = consume()
    const value = consume()
    if (!mnemonic || mnemonic.type !== 'IDENT')
      return null
    if (!operator || operator.type !== 'OP')
      return null
    if (!value || (value.type !== 'VALUE' && value.type !== 'IDENT'))
      return null

    return {
      id: nextId('rule'),
      type: 'rule',
      mnemonic: mnemonic.value,
      condition: operator.value,
      value: value.value,
    }
  }

  const combine = (left: ConditionRule, right: ConditionRule, op: 'AND' | 'OR'): ConditionRule => {
    if (left.type === 'group' && left.operator === op && !left.negate) {
      return {
        ...left,
        rules: [...(left.rules || []), right],
      }
    }

    return {
      id: nextId('group'),
      type: 'group',
      operator: op,
      rules: [left, right],
    }
  }

  let parseOr: () => ConditionRule | null = () => null

  const parsePrimary = (): ConditionRule | null => {
    const token = peek()
    if (!token)
      return null

    if (token.type === 'LPAREN') {
      consume()
      const expr = parseOr()
      const close = consume()
      if (!expr || !close || close.type !== 'RPAREN')
        return null
      return expr
    }

    return parseRule()
  }

  const parseUnary = (): ConditionRule | null => {
    const token = peek()
    if (!token)
      return null

    if (token.type === 'NOT') {
      consume()
      const node = parsePrimary()
      if (!node)
        return null
      if (node.type !== 'rule')
        return null
      return {
        ...node,
        negate: true,
      }
    }

    return parsePrimary()
  }

  const parseAnd = (): ConditionRule | null => {
    let left = parseUnary()
    if (!left)
      return null

    while (peek()?.type === 'AND') {
      consume()
      const right = parseUnary()
      if (!right)
        return null
      left = combine(left, right, 'AND')
    }

    return left
  }

  parseOr = (): ConditionRule | null => {
    let left = parseAnd()
    if (!left)
      return null

    while (peek()?.type === 'OR') {
      consume()
      const right = parseAnd()
      if (!right)
        return null
      left = combine(left, right, 'OR')
    }

    return left
  }

  const parsed = parseOr()
  if (!parsed)
    return null
  if (index !== tokens.length)
    return null

  return parsed
}

function generateLogicFromRules(rule: ConditionRule, depth = 0): string {
  if (rule.type === 'rule') {
    if (!rule.mnemonic || !rule.condition)
      return ''
    let result = `${rule.mnemonic} ${rule.condition} ${rule.value}`
    if (rule.negate)
      result = `NOT (${result})`
    return result
  }

  if (rule.type === 'group' && rule.rules && rule.rules.length > 0) {
    const op = rule.operator || 'AND'
    const parts = rule.rules.map(r => generateLogicFromRules(r, depth + 1)).filter(s => s.length > 0)
    const grouped = parts.join(` ${op} `)

    if (depth === 0)
      return grouped
    return `(${grouped})`
  }

  return ''
}
</script>

<template>
  <div class="content p-4">
    <AppName v-if="!props.embedMode" appname="Update TC DB" />

    <div class="controls" :class="props.embedMode ? 'mt-2' : 'mt-4'">
      <div class="control-item">
        <label class="label">Subsystems</label>
        <MultiSelect
          v-model="selectedSubsystems"
          :options="subsystems"
          :filter="true"
          :max-selected-labels="3"
          placeholder="Select subsystem(s)..."
          class="w-72"
        />
      </div>

      <div class="control-item grow">
        <label class="label">Quick Filter</label>
        <InputText
          v-model="quickFilter"
          placeholder="Filter by CID / mnemonic / conditions..."
          class="w-full"
        />
      </div>

      <Button
        label="Save TC Updates"
        icon="pi pi-save"
        :loading="saving"
        :disabled="changedIds.size === 0"
        @click="saveChanges"
      />
    </div>

    <Message v-if="saveMessage" :severity="saveMessage.type === 'success' ? 'success' : 'error'" class="mt-3">
      {{ saveMessage.text }}
    </Message>

    <div v-if="loading" class="loading-box mt-4">
      <i class="pi pi-spin pi-spinner" />
      <span>Loading telecommand records...</span>
    </div>

    <div v-else-if="rowData.length > 0" class="ag-wrapper mt-4">
      <AgGridVue
        :theme="gridTheme"
        class="ag-theme-local"
        :row-data="rowData"
        :column-defs="columnDefs"
        :default-col-def="defaultColDef"
        :cell-selection="cellSelection"
        :suppress-click-edit="false"
        :stop-editing-when-cells-lose-focus="true"
        :animate-rows="true"
        @grid-ready="onGridReady"
        @cell-value-changed="onCellValueChanged"
        @cell-double-clicked="onCellDoubleClicked"
      />
    </div>

    <div v-else-if="selectedSubsystems.length > 0" class="no-data mt-4">
      <i class="pi pi-inbox text-3xl" />
      <p>No telecommand records found for selected subsystem(s).</p>
    </div>

    <Dialog
      v-model:visible="showConditionEditor"
      modal
      header="Edit Condition"
      :style="{ width: 'min(1100px, 96vw)' }"
    >
      <div class="condition-dialog">
        <div class="condition-toolbar">
          <Button
            label="Visual Builder"
            size="small"
            :outlined="conditionType !== 'visualBuilder'"
            @click="switchConditionType('visualBuilder')"
          />
          <Button
            label="Monaco Editor"
            size="small"
            :outlined="conditionType !== 'monacoEditor'"
            @click="switchConditionType('monacoEditor')"
          />
        </div>

        <div class="condition-panel mt-3">
          <div v-if="conditionType === 'visualBuilder'" class="builder-wrap">
            <div class="control-item mb-3">
              <label class="label">Condition Subsystems</label>
              <MultiSelect
                v-model="conditionSubsystems"
                :options="conditionSubsystemOptions"
                :filter="true"
                :max-selected-labels="3"
                placeholder="Select subsystem(s) for condition..."
                class="w-full"
              />
            </div>
            <QueryBuilder
              v-model="conditionRule"
              :mnemonics="conditionMnemonics.filter(m => conditionSubsystems.length === 0 || conditionSubsystems.includes(String(m.subsystem || '')))"
              mode="full"
              @generate="conditionDraft = $event"
            />
          </div>

          <div v-else class="monaco-wrap">
            <MonacoConditionEditor
              v-model="conditionDraft"
              :mnemonics="conditionMnemonics.filter(m => conditionSubsystems.length === 0 || conditionSubsystems.includes(String(m.subsystem || '')))"
              height="42vh"
            />
          </div>
        </div>

        <div class="condition-preview mt-3">
          <label class="label">Formatted Preview</label>
          <div class="preview-box">
            {{ formatConditionCell(conditionDraft) }}
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showConditionEditor = false" />
        <Button label="Apply Condition" icon="pi pi-check" @click="applyConditionEditor" />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="showDataCodeMapEditor"
      modal
      header="Edit dataCodeMap"
      :style="{ width: 'min(900px, 94vw)' }"
    >
      <div class="controls mb-3">
        <Button label="Add Row" icon="pi pi-plus" size="small" @click="addDataCodeMapRow" />
        <Button label="Delete Selected" icon="pi pi-trash" severity="danger" outlined size="small" @click="deleteSelectedDataCodeMapRows" />
      </div>

      <div class="inner-grid">
        <AgGridVue
          :theme="gridTheme"
          class="ag-theme-local"
          :row-data="dataCodeMapRows"
          :column-defs="dataCodeMapColumnDefs"
          :default-col-def="{ resizable: true }"
          row-selection="multiple"
          @grid-ready="onDataCodeMapGridReady"
        />
      </div>

      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showDataCodeMapEditor = false" />
        <Button label="Apply" icon="pi pi-check" @click="applyDataCodeMapEditor" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped lang="scss">
.controls {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
}

.control-item {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.control-item.grow {
  flex: 1;
  min-width: 280px;
}

.label {
  font-weight: 600;
  font-size: 0.9rem;
}

.loading-box {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--text-color-secondary);
}

.no-data {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-color-secondary);
}

.ag-wrapper {
  height: calc(100vh - 18rem);
  min-height: 30rem;
  width: 100%;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  overflow: hidden;
}

.inner-grid {
  height: 360px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  overflow: hidden;
}

.ag-theme-local {
  height: 100%;
  width: 100%;
}

:deep(.condition-cell) {
  cursor: pointer;
  color: var(--primary-color);
  text-decoration: underline;
  text-underline-offset: 2px;
}

:deep(.readonly-cell) {
  opacity: 0.7;
  cursor: default;
}

.condition-toolbar {
  display: flex;
  gap: 0.5rem;
}

.builder-wrap,
.monaco-wrap {
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 0.75rem;
  min-height: 20rem;
}

.preview-box {
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: var(--surface-ground);
  padding: 0.75rem;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 3rem;
}
</style>
