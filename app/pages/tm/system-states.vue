<script setup lang='ts'>
import { computed, onMounted, ref, watch } from 'vue'
import MonacoConditionEditor from '@/components/tm/MonacoConditionEditor.vue'
import QueryBuilder from '@/components/tm/QueryBuilder.vue'
import { initMenu } from '@/composables/tm/SideNav'

definePageMeta({ title: 'Telemetry - System States' })
initMenu(6)

interface ConditionRule {
  id: string
  type: 'rule' | 'group'
  condition?: string
  value?: string
  mnemonic?: string
  operator?: string
  rules?: ConditionRule[]
  negate?: boolean
}

interface StateCondition {
  type: 'visualBuilder' | 'monacoEditor'
  logic: string
  rule?: ConditionRule | null // for visual builder
}

interface MnemonicInfo {
  mnemonic: string
  type: string
  unit: string
  description?: string
  valueSuggestions?: string[]
  defaultValue?: string
}

interface MnemonicLimitMapping {
  mnemonic: string
  limits: string[]
  tolerance?: string
  active: boolean
}

interface SystemState {
  id: string
  name: string
  description: string
  condition: StateCondition
  mnemonics: MnemonicLimitMapping[]
  createdAt: number
}

const storageKey = 'tm.systemStates.v1'
const gatewayBase = import.meta.client
  ? `http://${window.location.host}/api/go/v1`
  : ''

console.log('🔧 System States - Initialized')
console.log('   Gateway Base:', gatewayBase)
console.log('   Client Side:', import.meta.client)

// UI State
const states = ref<SystemState[]>([])
const editingState = ref<SystemState | null>(null)
const showStateDialog = ref(false)
const showConditionEditor = ref(false)
const showMnemonicsDialog = ref(false)
const message = ref<{ type: 'success' | 'error', text: string } | null>(null)
const selectedMnemonics = ref<string[]>([])
const conditionDraft = ref('')
const conditionRule = ref<ConditionRule | null>(null)
const conditionType = ref<'visualBuilder' | 'monacoEditor'>('visualBuilder')
const loadingMnemonics = ref(false)
let conditionSyncing = false

// Debug function
async function testApiConnection() {
  console.clear()
  console.log('🔧 ===== API DEBUG TEST =====')
  console.log('Gateway Base:', gatewayBase)

  try {
    console.log('\n1️⃣ Testing /telemetry/subsystems endpoint...')
    const subsUrl = `${gatewayBase}/telemetry/subsystems`
    console.log(`   URL: ${subsUrl}`)
    const subsResponse = await fetch(subsUrl)
    console.log(`   Status: ${subsResponse.status}`)
    const subsData = await subsResponse.json()
    console.log(`   Response:`, subsData)
    console.log(`   Type: ${typeof subsData}`)
    console.log(`   Is Array: ${Array.isArray(subsData)}`)
    if (typeof subsData === 'object') {
      console.log(`   Keys: ${Object.keys(subsData).join(', ')}`)
    }

    // If we got subsystems, test mnemonics endpoint
    let testSubsystem = ''
    if (Array.isArray(subsData)) {
      testSubsystem = subsData[0]
    }
    else if (subsData?.subsystems && Array.isArray(subsData.subsystems)) {
      testSubsystem = subsData.subsystems[0]
    }

    if (testSubsystem) {
      console.log(`\n2️⃣ Testing /mnemonics/tm/{subsystem} endpoint...`)
      const mnemUrl = `${gatewayBase}/mnemonics/tm/${encodeURIComponent(testSubsystem)}`
      console.log(`   URL: ${mnemUrl}`)
      const mnemResponse = await fetch(mnemUrl)
      console.log(`   Status: ${mnemResponse.status}`)
      const mnemData = await mnemResponse.json()
      console.log(`   Response Count: ${Array.isArray(mnemData) ? mnemData.length : 'not array'}`)
      console.log(`   First item:`, Array.isArray(mnemData) ? mnemData[0] : mnemData)
    }

    message.value = { type: 'success', text: '✅ API Debug info logged to console (F12)' }
  }
  catch (e: any) {
    console.error('❌ Error during debug:', e)
    message.value = { type: 'error', text: `❌ Debug Error: ${e?.message}` }
  }
}

// API Data
const allApiMnemonics = ref<MnemonicInfo[]>([])
const subsystems = ref<string[]>([])

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value))
    return []
  return value
    .map(v => String(v ?? '').trim())
    .filter(v => v.length > 0)
}

type LogicTokenType = 'LPAREN' | 'RPAREN' | 'AND' | 'OR' | 'NOT' | 'IDENT' | 'OP' | 'VALUE'

interface LogicToken {
  type: LogicTokenType
  value: string
}

function tokenizeLogic(input: string): LogicToken[] {
  const tokens: LogicToken[] = []
  let i = 0

  const push = (type: LogicTokenType, value: string) => {
    tokens.push({ type, value })
  }

  while (i < input.length) {
    const ch = input[i]
    if (!ch) {
      break
    }

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
        if (!curr) {
          break
        }
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
      if (upper === 'AND') {
        push('AND', 'AND')
      }
      else if (upper === 'OR') {
        push('OR', 'OR')
      }
      else if (upper === 'NOT') {
        push('NOT', 'NOT')
      }
      else if (/^-?\d+(?:\.\d+)?$/.test(word)) {
        push('VALUE', word)
      }
      else {
        push('IDENT', word)
      }
      i += word.length
      continue
    }

    return []
  }

  return tokens
}

function parseLogicToRule(logic: string): ConditionRule | null {
  const tokens = tokenizeLogic(logic)
  if (!tokens.length) {
    return null
  }

  let index = 0
  let idCounter = 0

  const nextId = (prefix: 'rule' | 'group') => `${prefix}_parsed_${Date.now()}_${idCounter++}`
  const peek = () => tokens[index]
  const consume = () => tokens[index++]

  const parseRule = (): ConditionRule | null => {
    const mnemonic = consume()
    const operator = consume()
    const value = consume()
    if (!mnemonic || mnemonic.type !== 'IDENT') {
      return null
    }
    if (!operator || operator.type !== 'OP') {
      return null
    }
    if (!value || (value.type !== 'VALUE' && value.type !== 'IDENT')) {
      return null
    }

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
    if (!token) {
      return null
    }

    if (token.type === 'LPAREN') {
      consume()
      const expr = parseOr()
      const close = consume()
      if (!expr || !close || close.type !== 'RPAREN') {
        return null
      }
      return expr
    }

    return parseRule()
  }

  const parseUnary = (): ConditionRule | null => {
    const token = peek()
    if (!token) {
      return null
    }

    if (token.type === 'NOT') {
      consume()
      const node = parsePrimary()
      if (!node) {
        return null
      }
      if (node.type !== 'rule') {
        return null
      }
      return {
        ...node,
        negate: true,
      }
    }

    return parsePrimary()
  }

  const parseAnd = (): ConditionRule | null => {
    let left = parseUnary()
    if (!left) {
      return null
    }

    while (peek()?.type === 'AND') {
      consume()
      const right = parseUnary()
      if (!right) {
        return null
      }
      left = combine(left, right, 'AND')
    }

    return left
  }

  parseOr = (): ConditionRule | null => {
    let left = parseAnd()
    if (!left) {
      return null
    }

    while (peek()?.type === 'OR') {
      consume()
      const right = parseAnd()
      if (!right) {
        return null
      }
      left = combine(left, right, 'OR')
    }

    return left
  }

  const parsed = parseOr()
  if (!parsed) {
    return null
  }
  if (index !== tokens.length) {
    return null
  }
  return parsed
}

const availableMnemonics = computed(() => {
  if (!editingState.value)
    return []
  return editingState.value.mnemonics.map(m => m.mnemonic)
})

const unselectedMnemonics = computed(() => {
  if (!editingState.value)
    return []
  const selected = new Set(editingState.value.mnemonics.map(m => m.mnemonic))
  return allApiMnemonics.value.filter(m => !selected.has(m.mnemonic))
})

function loadStates() {
  try {
    const storedData = localStorage.getItem(storageKey)
    if (storedData) {
      states.value = JSON.parse(storedData)
    }
  }
  catch {
    states.value = []
  }
}

function saveStates() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(states.value))
    message.value = { type: 'success', text: 'States saved successfully' }
  }
  catch (e: any) {
    message.value = { type: 'error', text: 'Failed to save states' }
  }
}

async function loadSubsystems() {
  try {
    const fullUrl = `${gatewayBase}/telemetry/subsystems`
    console.log('📡 Fetching subsystems from:', fullUrl)

    const response = await $fetch<any>(fullUrl)
    console.log('📦 Raw API response:', response)

    // Try different response formats
    let subs: string[] = []
    if (Array.isArray(response)) {
      subs = response
    }
    else if (response?.subsystems && Array.isArray(response.subsystems)) {
      subs = response.subsystems
    }
    else if (typeof response === 'object' && response !== null) {
      // Try to find array in response
      const keys = Object.keys(response)
      console.log('📋 Response keys:', keys)
      for (const key of keys) {
        if (Array.isArray(response[key]) && response[key].length > 0) {
          subs = response[key]
          break
        }
      }
    }

    subsystems.value = subs
    console.log(`✅ Loaded ${subs.length} subsystems:`, subs)
  }
  catch (e: any) {
    console.error('❌ ERROR fetching subsystems:', e)
    console.error('Details:', {
      message: e?.message,
      status: e?.status,
      statusCode: e?.statusCode,
      data: e?.data,
      url: `${gatewayBase}/telemetry/subsystems`,
    })
    subsystems.value = []
  }
}

async function loadMnemonicsFromApi() {
  loadingMnemonics.value = true
  console.log('Starting loadMnemonicsFromApi...')

  try {
    if (subsystems.value.length === 0) {
      console.log('No subsystems loaded, fetching...')
      await loadSubsystems()
    }

    console.log('Subsystems to fetch:', subsystems.value)

    if (subsystems.value.length === 0) {
      message.value = { type: 'warning', text: 'No subsystems available from API' }
      allApiMnemonics.value = []
      loadingMnemonics.value = false
      return
    }

    const allMnemonics: MnemonicInfo[] = []

    for (const subsystem of subsystems.value) {
      try {
        const endpoint = `${gatewayBase}/mnemonics/tm/${encodeURIComponent(subsystem)}`
        console.log(`Fetching mnemonics from: ${endpoint}`)

        const rows = await $fetch<any[]>(endpoint)
        console.log(`Got ${Array.isArray(rows) ? rows.length : 0} rows from ${subsystem}:`, rows)

        if (Array.isArray(rows)) {
          for (const row of rows) {
            const rawMnemonic = String(row.cdbMnemonic ?? row.mnemonic ?? '').trim()
            const pid = String(row.pid ?? row.cdbPid ?? row._id ?? '').trim()
            const mnemonicName = pid ? `${pid}_${rawMnemonic}` : rawMnemonic
            const suggestions = toStringArray(row.range ?? row.rangeOptions ?? row.limits)
            const expected = String(row.expected_value ?? row.expectedValue ?? '').trim()
            const defaultValue = expected || suggestions[0] || ''

            if (mnemonicName.trim().length > 2) {
              allMnemonics.push({
                mnemonic: mnemonicName,
                type: String(row.type ?? '').toUpperCase(),
                unit: String(row.unit ?? ''),
                description: String(row.description ?? row.processingType ?? ''),
                valueSuggestions: expected && !suggestions.includes(expected)
                  ? [expected, ...suggestions]
                  : suggestions,
                defaultValue,
              })
            }
          }
        }
      }
      catch (e: any) {
        console.warn(`Failed to load mnemonics for subsystem ${subsystem}:`, e?.data?.error || e?.message || e)
      }
    }

    console.log('Total mnemonics collected:', allMnemonics.length)
    allApiMnemonics.value = allMnemonics

    if (allMnemonics.length === 0) {
      message.value = { type: 'warning', text: 'No mnemonics found in API (check console for details)' }
    }
    else {
      message.value = { type: 'success', text: `✅ Loaded ${allApiMnemonics.value.length} mnemonics from API` }
    }
  }
  catch (e: any) {
    console.error('Fatal error in loadMnemonicsFromApi:', e)
    message.value = { type: 'error', text: `Failed to load mnemonics: ${e?.message || e}` }
    allApiMnemonics.value = []
  }
  finally {
    loadingMnemonics.value = false
  }
}

function createNewState() {
  editingState.value = {
    id: `state_${Date.now()}`,
    name: '',
    description: '',
    condition: {
      type: 'visualBuilder',
      logic: '',
      rule: null,
    },
    mnemonics: [],
    createdAt: Date.now(),
  }
  showStateDialog.value = true
}

function editState(state: SystemState) {
  editingState.value = JSON.parse(JSON.stringify(state))
  showStateDialog.value = true
}

function deleteState(id: string) {
  states.value = states.value.filter(s => s.id !== id)
  saveStates()
  message.value = { type: 'success', text: 'State deleted' }
}

function saveState() {
  if (!editingState.value)
    return

  if (!editingState.value.name.trim()) {
    message.value = { type: 'error', text: 'State name is required' }
    return
  }

  if (!editingState.value.condition.logic.trim()) {
    message.value = { type: 'error', text: 'Condition logic is required' }
    return
  }

  const idx = states.value.findIndex(s => s.id === editingState.value!.id)
  if (idx >= 0) {
    states.value[idx] = { ...editingState.value }
  }
  else {
    states.value.push({ ...editingState.value })
  }

  saveStates()
  showStateDialog.value = false
  editingState.value = null
  message.value = { type: 'success', text: 'State saved successfully' }
}

function openConditionEditor() {
  if (!editingState.value)
    return
  conditionDraft.value = editingState.value.condition.logic
  conditionRule.value = editingState.value.condition.rule || parseLogicToRule(editingState.value.condition.logic) || null
  conditionType.value = editingState.value.condition.type
  showConditionEditor.value = true
}

function saveConditionEditor() {
  if (!editingState.value)
    return

  // For visual builder, generate logic from rules
  if (conditionType.value === 'visualBuilder' && conditionRule.value) {
    editingState.value.condition.logic = generateLogicFromRules(conditionRule.value)
    editingState.value.condition.rule = conditionRule.value
  }
  else {
    editingState.value.condition.logic = conditionDraft.value
    editingState.value.condition.rule = parseLogicToRule(conditionDraft.value) || null
  }

  editingState.value.condition.type = conditionType.value
  showConditionEditor.value = false
  message.value = { type: 'success', text: 'Condition updated' }
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

    if (depth === 0) {
      return grouped
    }
    return `(${grouped})`
  }

  return ''
}

function openMnemonicsDialog() {
  if (!editingState.value)
    return
  selectedMnemonics.value = editingState.value.mnemonics.map(m => m.mnemonic)
  showMnemonicsDialog.value = true
}

function saveMnemonicsSelection() {
  if (!editingState.value)
    return

  // Keep existing mappings for selected mnemonics, create new ones for added
  const existing = new Map(editingState.value.mnemonics.map(m => [m.mnemonic, m]))

  editingState.value.mnemonics = selectedMnemonics.value.map((mnemonic) => {
    const existing_mapping = existing.get(mnemonic)
    return existing_mapping || {
      mnemonic,
      limits: [],
      active: true,
    }
  })

  showMnemonicsDialog.value = false
  message.value = { type: 'success', text: 'Mnemonics updated' }
}

function updateMnemonicLimits(mnemonic: string, limits: string) {
  if (!editingState.value)
    return
  const mapping = editingState.value.mnemonics.find(m => m.mnemonic === mnemonic)
  if (mapping) {
    mapping.limits = limits.split(',').map(l => l.trim()).filter(l => l.length > 0)
  }
}

function updateMnemonicTolerance(mnemonic: string, tolerance: string) {
  if (!editingState.value)
    return
  const mapping = editingState.value.mnemonics.find(m => m.mnemonic === mnemonic)
  if (mapping) {
    mapping.tolerance = tolerance || undefined
  }
}

function toggleMnemonicActive(mnemonic: string) {
  if (!editingState.value)
    return
  const mapping = editingState.value.mnemonics.find(m => m.mnemonic === mnemonic)
  if (mapping) {
    mapping.active = !mapping.active
  }
}

onMounted(async () => {
  loadStates()
  await loadMnemonicsFromApi()
})

watch(
  conditionRule,
  (rule) => {
    if (conditionSyncing) {
      return
    }
    if (conditionType.value !== 'visualBuilder') {
      return
    }

    const generated = rule ? generateLogicFromRules(rule) : ''
    if (generated === conditionDraft.value) {
      return
    }

    conditionSyncing = true
    conditionDraft.value = generated
    conditionSyncing = false
  },
  { deep: true },
)

watch(
  conditionDraft,
  (logic) => {
    if (conditionSyncing) {
      return
    }
    if (conditionType.value !== 'monacoEditor') {
      return
    }

    const parsed = parseLogicToRule(logic)
    if (!parsed) {
      return
    }

    conditionSyncing = true
    conditionRule.value = parsed
    conditionSyncing = false
  },
)

function switchConditionType(newType: 'visualBuilder' | 'monacoEditor') {
  if (newType === conditionType.value)
    return

  if (newType === 'monacoEditor') {
    // Sync visual builder → Monaco: generate logic from current rules immediately
    if (conditionRule.value) {
      conditionDraft.value = generateLogicFromRules(conditionRule.value)
    }
  }
  else {
    // Sync Monaco → visual builder: parse current logic into rules immediately
    const parsed = parseLogicToRule(conditionDraft.value)
    if (parsed) {
      conditionRule.value = parsed
    }
  }

  conditionType.value = newType
}
</script>

<template>
  <div class="content p-4">
    <AppName appname="System States Configuration" />

    <!-- Diagnostic Info (for debugging) -->
    <div class="mb-4 p-3 surface-section border-round border border-yellow-500 text-xs">
      <p class="m-0 mb-2">
        <strong>API Endpoint:</strong> <code>{{ gatewayBase || '(NOT CONFIGURED)' }}/telemetry/subsystems</code>
      </p>
      <p class="m-0">
        <strong>Status:</strong>
        <span v-if="loadingMnemonics" class="text-primary">🔄 Loading mnemonics...</span>
        <span v-else-if="allApiMnemonics.length > 0" class="text-green-500">✅ {{ allApiMnemonics.length }} mnemonics loaded</span>
        <span v-else-if="subsystems.length > 0" class="text-yellow-600">⚠️ Subsystems loaded but no mnemonics</span>
        <span v-else class="text-red-500">❌ No data loaded (see Debug button below)</span>
      </p>
    </div>

    <div class="intro-section mt-4 p-4 surface-section border-round">
      <h3 class="mt-0">
        How System States Work
      </h3>
      <p class="text-sm">
        Define system states based on telemetry conditions. Each state determines which telemetry
        mnemonics to monitor and what limits to apply. When the system enters a state, only the
        mnemonics defined for that state will be checked against their configured limits.
      </p>
      <ul class="text-sm">
        <li><strong>State Condition:</strong> A logical expression combining telemetry values that determines if the system is in this state</li>
        <li><strong>Mnemonics:</strong> Telemetry parameters to monitor when the system is in this state</li>
        <li><strong>Limits:</strong> Valid values or ranges for each mnemonic in this state</li>
      </ul>
    </div>

    <div class="controls mt-4">
      <Button label="Create New State" icon="pi pi-plus" @click="createNewState" />
      <Button
        v-tooltip="'Open DevTools Console (F12) to see detailed API responses'"
        label="Debug: Test API Connection"
        icon="pi pi-code"
        severity="secondary"
        text
        @click="testApiConnection"
      />
    </div>

    <Message v-if="message" :severity="message.type === 'success' ? 'success' : 'error'" class="mt-3">
      {{ message.text }}
    </Message>

    <div class="states-grid mt-4">
      <div
        v-for="state in states"
        :key="state.id"
        class="state-card surface-section border border-surface-border surface-border p-4 border-round"
      >
        <div class="flex justify-between align-items-start mb-3">
          <div class="flex-1">
            <h4 class="m-0 text-lg font-semibold">
              {{ state.name }}
            </h4>
            <p class="text-xs text-surface-500 mt-1">
              {{ state.description }}
            </p>
          </div>
          <div class="flex gap-2">
            <Button
              v-tooltip="'Edit State'"
              icon="pi pi-pencil"
              rounded
              text
              severity="info"
              @click="editState(state)"
            />
            <Button
              v-tooltip="'Delete State'"
              icon="pi pi-trash"
              rounded
              text
              severity="danger"
              @click="deleteState(state.id)"
            />
          </div>
        </div>

        <div class="state-info">
          <div class="info-item">
            <label>Condition:</label>
            <code class="text-xs">{{ state.condition.logic.substring(0, 50) }}{{ state.condition.logic.length > 50 ? '...' : '' }}</code>
          </div>
          <div class="info-item">
            <label>Mnemonics:</label>
            <div class="flex flex-wrap gap-2 mt-1">
              <Chip
                v-for="mnem in state.mnemonics"
                :key="mnem.mnemonic"
                :label="mnem.mnemonic"
                class="text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      <div v-if="states.length === 0" class="empty-state text-center py-8">
        <i class="pi pi-inbox text-surface-400 text-4xl block mb-3" />
        <p class="text-surface-500">
          No system states defined. Create one to get started.
        </p>
      </div>
    </div>
  </div>

  <!-- State Editor Dialog -->
  <Dialog
    v-model:visible="showStateDialog"
    modal
    :header="`${editingState?.id && states.some(s => s.id === editingState.id) ? 'Edit' : 'Create'} State`"
    :style="{ width: '700px', maxWidth: '90vw' }"
  >
    <div v-if="editingState" class="dialog-content">
      <!-- Basic Info -->
      <div class="field grid">
        <label for="stateName" class="col-12 mb-2 font-semibold">State Name *</label>
        <InputText
          id="stateName"
          v-model="editingState.name"
          class="col-12"
          placeholder="e.g., Pre-Launch, In-Orbit, Safe Mode"
        />
      </div>

      <div class="field grid">
        <label for="stateDesc" class="col-12 mb-2 font-semibold">Description</label>
        <Textarea
          id="stateDesc"
          v-model="editingState.description"
          class="col-12"
          rows="2"
          placeholder="Describe when this state is active..."
        />
      </div>

      <!-- Condition Section -->
      <Divider class="my-4" />
      <div class="mb-4">
        <div class="flex justify-between align-items-center mb-3">
          <h4 class="m-0">
            State Condition *
          </h4>
          <Button
            label="Edit Condition"
            icon="pi pi-pencil"
            size="small"
            severity="info"
            text
            @click="openConditionEditor"
          />
        </div>
        <div class="condition-preview surface-ground p-3 border-round text-xs">
          <code v-if="editingState.condition.logic">{{ editingState.condition.logic }}</code>
          <span v-else class="text-surface-400">No condition defined</span>
        </div>
      </div>

      <!-- Mnemonics Section -->
      <Divider class="my-4" />
      <div class="mb-4">
        <div class="flex justify-between align-items-center mb-3">
          <h4 class="m-0">
            Monitored Mnemonics ({{ editingState.mnemonics.length }})
          </h4>
          <Button
            label="Select Mnemonics"
            icon="pi pi-list"
            size="small"
            severity="info"
            text
            @click="openMnemonicsDialog"
          />
        </div>

        <div v-if="editingState.mnemonics.length > 0" class="mnemonics-list">
          <div
            v-for="mnem in editingState.mnemonics"
            :key="mnem.mnemonic"
            class="mnemonic-item surface-ground p-3 mb-2 border-round border border-surface-border"
          >
            <div class="flex justify-between align-items-start mb-2">
              <div class="flex align-items-center gap-2">
                <Checkbox
                  :model-value="mnem.active"
                  :binary="true"
                  @change="toggleMnemonicActive(mnem.mnemonic)"
                />
                <span class="font-semibold">{{ mnem.mnemonic }}</span>
              </div>
            </div>

            <div class="grid gap-2 ml-4">
              <div class="field grid mb-0">
                <label class="col-6 text-xs font-semibold">Limits (comma-separated):</label>
                <InputText
                  class="col-6 text-xs"
                  :model-value="mnem.limits.join(', ')"
                  placeholder="e.g., LOW, NORMAL, HIGH"
                  @input="(e: any) => updateMnemonicLimits(mnem.mnemonic, e.target.value)"
                />
              </div>
              <div class="field grid mb-0">
                <label class="col-6 text-xs font-semibold">Tolerance (optional):</label>
                <InputText
                  class="col-6 text-xs"
                  :model-value="mnem.tolerance || ''"
                  placeholder="e.g., ±0.5"
                  @input="(e: any) => updateMnemonicTolerance(mnem.mnemonic, e.target.value)"
                />
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-center text-surface-400 py-4">
          No mnemonics selected. Click "Select Mnemonics" to add them.
        </div>
      </div>
    </div>

    <template #footer>
      <Button label="Cancel" text @click="showStateDialog = false" />
      <Button label="Save State" icon="pi pi-check" @click="saveState" />
    </template>
  </Dialog>

  <!-- Condition Editor Dialog -->
  <Dialog
    v-model:visible="showConditionEditor"
    modal
    header="Edit State Condition"
    :style="{ width: '90vw', maxWidth: '1400px', maxHeight: '90vh' }"
    class="condition-editor-dialog"
  >
    <div v-if="editingState">
      <!-- Editor Type Selector -->
      <div class="mb-4">
        <label class="font-semibold block mb-2">Editor Type</label>
        <div class="flex gap-3">
          <div class="flex align-items-center">
            <RadioButton
              :model-value="conditionType"
              name="editorType"
              value="visualBuilder"
              input-id="visualOption"
              @change="switchConditionType('visualBuilder')"
            />
            <label for="visualOption" class="ml-2 cursor-pointer">Visual Logic Builder (jQuery Query Style)</label>
          </div>
          <div class="flex align-items-center">
            <RadioButton
              :model-value="conditionType"
              name="editorType"
              value="monacoEditor"
              input-id="monacoOption"
              @change="switchConditionType('monacoEditor')"
            />
            <label for="monacoOption" class="ml-2 cursor-pointer">Monaco Code Editor</label>
          </div>
        </div>
      </div>

      <Divider />

      <!-- Visual Logic Builder (QueryBuilder) -->
      <div v-if="conditionType === 'visualBuilder'" class="visual-builder-section">
        <div class="mb-3">
          <h4 class="mt-0">
            Visual Condition Builder
          </h4>
          <p class="text-sm text-surface-500 mb-3">
            Build complex conditions by combining telemetry mnemonics with logical operators.
            Mnemonics are loaded from your satellite's telemetry system (PID_Mnemonic format).
          </p>

          <div v-if="loadingMnemonics" class="flex align-items-center gap-2 mb-4 text-surface-500">
            <i class="pi pi-spin pi-spinner" />
            Loading {{ allApiMnemonics.length }} mnemonics from API...
          </div>
        </div>

        <QueryBuilder
          v-model="conditionRule"
          :mnemonics="allApiMnemonics"
        />
      </div>

      <!-- Monaco Editor -->
      <div v-else class="monaco-section">
        <div class="mb-3">
          <h4 class="mt-0">
            Code Editor
          </h4>
          <p class="text-xs text-surface-500 mb-3">
            Write JavaScript expressions using PID_Mnemonic format. Use comparison operators: ==, !=, &gt;, &lt;, &gt;=, &lt;=.
            Combine with logical operators: && (AND), || (OR), ! (NOT).
          </p>
        </div>

        <div class="p-4 surface-section border-round border border-surface-border">
          <label class="block font-semibold text-sm mb-2">Condition Logic</label>
          <MonacoConditionEditor
            v-model="conditionDraft"
            :mnemonics="allApiMnemonics"
            height="42vh"
          />
          <p class="text-xs text-surface-400 mt-2">
            <i class="pi pi-info-circle mr-1" />
            Mnemonics available: {{ allApiMnemonics.length }} total (PID_Mnemonic format)
          </p>
        </div>
      </div>

      <!-- Generated Logic Preview -->
      <div class="mt-4 p-3 surface-section border-round border-left-4 border-blue-500">
        <p class="text-xs font-semibold text-surface-500 mb-2">
          Generated Logic:
        </p>
        <code class="text-xs text-primary block overflow-x-auto">
          {{ conditionDraft || '(build condition above)' }}
        </code>
      </div>
    </div>

    <template #footer>
      <Button label="Cancel" text @click="showConditionEditor = false" />
      <Button label="Save" icon="pi pi-check" @click="saveConditionEditor" />
    </template>
  </Dialog>

  <!-- Mnemonics Selection Dialog -->
  <Dialog
    v-model:visible="showMnemonicsDialog"
    modal
    header="Select Mnemonics to Monitor"
    :style="{ width: '600px', maxWidth: '90vw', maxHeight: '80vh' }"
  >
    <div v-if="editingState">
      <p class="text-sm mb-4">
        Select which telemetry mnemonics should be monitored when the system is in this state.
        Mnemonics are loaded from your satellite's telemetry system in PID_Mnemonic format.
      </p>

      <div class="mnemonics-selector">
        <div class="selected-mnemonics mb-4">
          <h5 class="text-xs font-semibold mb-2">
            Selected ({{ selectedMnemonics.length }})
          </h5>
          <div v-if="selectedMnemonics.length > 0" class="flex flex-wrap gap-2 mb-3">
            <Chip
              v-for="mnem in selectedMnemonics"
              :key="mnem"
              :label="mnem"
              removable
              class="text-xs"
              severity="info"
              @remove="selectedMnemonics = selectedMnemonics.filter(m => m !== mnem)"
            />
          </div>
          <div v-else class="text-xs text-surface-400 py-3">
            No mnemonics selected
          </div>
        </div>

        <Divider />

        <div class="available-mnemonics">
          <h5 class="text-xs font-semibold mb-3">
            Available Mnemonics ({{ unselectedMnemonics.length }})
          </h5>
          <div v-if="loadingMnemonics" class="flex align-items-center gap-2 text-surface-500">
            <i class="pi pi-spin pi-spinner" />
            <span class="text-xs">Loading mnemonics...</span>
          </div>
          <div v-else-if="unselectedMnemonics.length === 0" class="text-xs text-surface-400 py-3">
            All mnemonics are selected
          </div>
          <div v-else class="flex flex-wrap gap-2">
            <Button
              v-for="mnem in unselectedMnemonics"
              :key="mnem.mnemonic"
              v-tooltip="`${mnem.description || ''} (${mnem.unit || 'no unit'})`"
              :label="mnem.mnemonic"
              size="small"
              class="text-xs"
              @click="selectedMnemonics.push(mnem.mnemonic)"
            />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <Button label="Cancel" text @click="showMnemonicsDialog = false" />
      <Button label="Apply" icon="pi pi-check" @click="saveMnemonicsSelection" />
    </template>
  </Dialog>
</template>

<style scoped lang="scss">
.intro-section {
  background: linear-gradient(135deg, rgba(66, 165, 245, 0.05) 0%, rgba(156, 39, 176, 0.05) 100%);
  border: 1px solid rgba(66, 165, 245, 0.2);

  h3 {
    color: var(--primary-color);
  }

  ul {
    list-style: none;
    padding: 0;

    li {
      padding: 0.5rem 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);

      &:last-child {
        border-bottom: none;
      }
    }
  }
}

.states-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;

  .state-card {
    transition: all 0.3s ease;
    cursor: pointer;

    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }

    .state-info {
      .info-item {
        margin-bottom: 1rem;

        label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--surface-500);
          display: block;
          margin-bottom: 0.25rem;
        }

        code {
          background: var(--surface-ground);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          color: var(--primary-color);
          word-break: break-all;
        }
      }
    }
  }

  .empty-state {
    grid-column: 1 / -1;
  }
}

.dialog-content {
  .field {
    margin-bottom: 1.5rem;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .condition-preview {
    background: var(--surface-ground);
    border: 1px solid var(--surface-border);
    min-height: 60px;
    display: flex;
    align-items: center;
    overflow-x: auto;

    code {
      color: var(--primary-color);
    }
  }

  .mnemonics-list {
    max-height: 400px;
    overflow-y: auto;
  }

  .mnemonic-item {
    transition: all 0.2s ease;

    &:hover {
      background: var(--surface-card);
    }
  }
}

.visual-builder-section {
  .builder-example {
    background: var(--surface-ground);

    code {
      color: var(--primary-color);
      word-break: break-all;
    }
  }

  .builder-help {
    background: rgba(0, 0, 0, 0.02);
    padding: 1rem;
    border-radius: 4px;

    ul {
      margin: 0;
    }
  }
}

.monaco-section {
  textarea {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Droid Sans Mono', monospace;
    background: var(--surface-ground);
    color: var(--text-color);
  }
}

.mnemonics-selector {
  .selected-mnemonics,
  .available-mnemonics {
    padding: 1rem;
    background: var(--surface-ground);
    border-radius: 4px;
  }

  .available-mnemonics {
    background: rgba(0, 0, 0, 0.02);
  }
}
</style>
