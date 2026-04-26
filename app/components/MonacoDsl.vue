<script setup lang="ts">
import MonacoEditor from '@guolao/vue-monaco-editor'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import { onMounted } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  height?: string
}>(), {
  height: '55vh',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const TM_DSL_REGISTERED_KEY = '__tmDslLanguageRegistered__'
const TM_DSL_COMPLETION_REGISTERED_KEY = '__tmDslCompletionRegistered__'
const TM_DSL_WORKER_REGISTERED_KEY = '__tmDslMonacoWorkerRegistered__'

function ensureMonacoWorkers() {
  if (!import.meta.client)
    return

  const g = globalThis as Record<string, any>
  if (g[TM_DSL_WORKER_REGISTERED_KEY])
    return

  const existing = g.MonacoEnvironment as { getWorker?: (moduleId: string, label: string) => Worker } | undefined
  if (!existing?.getWorker) {
    g.MonacoEnvironment = {
      ...existing,
      getWorker(_: string, label: string) {
        if (label === 'json')
          return new jsonWorker()
        if (label === 'css' || label === 'scss' || label === 'less')
          return new cssWorker()
        if (label === 'html' || label === 'handlebars' || label === 'razor')
          return new htmlWorker()
        if (label === 'typescript' || label === 'javascript')
          return new tsWorker()
        return new editorWorker()
      },
    }
  }

  g[TM_DSL_WORKER_REGISTERED_KEY] = true
}

function getTmApiBases(): string[] {
  if (!import.meta.client)
    return []
  return [`${window.location.origin}/api/go/v1`]
}

async function fetchJSON<T>(path: string): Promise<T | null> {
  for (const base of getTmApiBases()) {
    try {
      const res = await fetch(`${base}${path}`)
      if (!res.ok)
        continue
      return await res.json() as T
    }
    catch {
      continue
    }
  }
  return null
}

// Julia language + ASTRA DSL word lists for the Monarch tokenizer
const JULIA_KEYWORDS = 'abstract baremodule begin break catch const continue do else elseif end export false finally for function global if import in isa let local macro module mutable primitive quote return struct true try type using where while new outer'.split(' ')
const ASTRA_DSL_KEYWORDS = 'TEST_NAME PRE_TEST_REQ SEND SENDTCP WAIT CHECK EXPECTED ALERT_MSG ABORT_TEST CALL BREAK IF ELSE END FOR IN TO WHILE ON_FAIL ON_TIMEOUT UNTIL TIMEOUT WITHIN'.split(' ')
const JULIA_BUILTINS = 'println print length size ndims push! pop! append! map filter reduce collect typeof typemax typemin zero one zeros ones sum prod minimum maximum abs sqrt log log2 log10 exp round floor ceil mod rem div string parse repr isnothing ismissing isnan isinf nothing missing NaN Inf pi error haskey get keys values pairs enumerate zip first last findfirst findall any all count split join strip replace startswith endswith contains match occursin uppercase lowercase open close read write readline readlines sort sort! unique unique! reverse reverse! copy deepcopy similar fill fill! reshape vec hcat vcat cat repeat'.split(' ')

const editorOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  wordWrap: 'on',
  tabSize: 2,
  fontSize: 13,
  automaticLayout: true,
  scrollBeyondLastLine: false,
  suggestOnTriggerCharacters: true,
  quickSuggestions: {
    other: true,
    comments: false,
    strings: true,
  },
  wordBasedSuggestions: 'currentDocument',
}

function registerTmDslLanguage() {
  const g = globalThis as Record<string, unknown>
  if (g[TM_DSL_REGISTERED_KEY])
    return

  if (monaco.languages.getLanguages().some(lang => lang.id === 'tmDsl')) {
    g[TM_DSL_REGISTERED_KEY] = true
    return
  }

  monaco.languages.register({ id: 'tmDsl' })

  monaco.languages.setLanguageConfiguration('tmDsl', {
    comments: { lineComment: '#', blockComment: ['#=', '=#'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: '`', close: '`' },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: '`', close: '`' },
    ],
    indentationRules: {
      increaseIndentPattern: /^\s*(function|if|for|while|begin|let|try|do|macro|module|struct|quote|mutable\s+struct)\b/,
      decreaseIndentPattern: /^\s*(end|else|elseif|catch|finally)\b/,
    },
  })

  monaco.languages.setMonarchTokensProvider('tmDsl', {
    defaultToken: '',
    tokenPostfix: '.jl',

    // Julia language keywords
    keywords: JULIA_KEYWORDS,

    // ASTRA DSL keywords from ACSParser.jl (TEST_NAME, SEND, WAIT, CHECK, …)
    dslKeywords: ASTRA_DSL_KEYWORDS,

    // Common Julia builtins
    builtins: JULIA_BUILTINS,

    tokenizer: {
      root: [
        // ASTRA DSL keywords (uppercase, matched before identifier rules)
        [/\b(TEST_NAME|PRE_TEST_REQ|SEND|SENDTCP|WAIT|CHECK|EXPECTED|ALERT_MSG|ABORT_TEST|CALL|BREAK|IF|ELSE|END|FOR|IN|TO|WHILE|ON_FAIL|ON_TIMEOUT|UNTIL|TIMEOUT|WITHIN)\b/, 'keyword.dsl'],

        // Macro annotations
        [/@[a-z_]\w*/i, 'annotation'],

        // Identifiers: classify as dsl keyword / julia keyword / builtin / identifier
        [/[a-z_]\w*[!?]?/i, {
          cases: {
            '@dslKeywords': 'keyword.dsl',
            '@keywords': 'keyword',
            '@builtins': 'support.function',
            '@default': 'identifier',
          },
        }],

        // Hex literals
        [/0x[\da-fA-F]+/, 'number.hex'],
        // Float / complex / integer
        [/\d+(\.\d+)?([eEf][+-]?\d+)?[im]?/, 'number'],

        // Block comments  #= ... =#
        [/#=/, 'comment', '@blockComment'],
        // Line comments
        [/#.*$/, 'comment'],

        // Triple-quoted strings
        [/"""/, { token: 'string.quote', bracket: '@open', next: '@tripleString' }],
        // Regular double-quoted strings
        [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
        // Backtick command strings
        [/`/, { token: 'string.quote', bracket: '@open', next: '@backtick' }],
        // Character literals
        [/'[^'\\]'|'\\.'/, 'string.char'],

        // Operators
        [/[=<>!~?:&|+\-*/^%]+/, 'operator'],
        // Delimiters
        [/[{}[\]()]/, 'delimiter'],
        [/[,;.]/, 'delimiter'],
        // Whitespace
        [/[ \t\r\n]+/, 'white'],
      ],

      blockComment: [
        [/[^=#]+/, 'comment'],
        [/#=/, 'comment', '@push'],
        [/=#/, 'comment', '@pop'],
        [/[=#]/, 'comment'],
      ],

      string: [
        [/\$[a-z_]\w*/i, 'variable.name'],
        [/\$\(/, { token: 'delimiter.bracket', bracket: '@open', next: '@interpolation' }],
        [/[^"\\$]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],

      tripleString: [
        [/\$[a-z_]\w*/i, 'variable.name'],
        [/\$\(/, { token: 'delimiter.bracket', bracket: '@open', next: '@interpolation' }],
        [/"""/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
        [/[^"\\$]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string'],
      ],

      backtick: [
        [/[^`]+/, 'string'],
        [/`/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],

      interpolation: [
        [/\)/, { token: 'delimiter.bracket', bracket: '@close', next: '@pop' }],
        { include: '@root' },
      ],
    },
  } as monaco.languages.IMonarchLanguage)
  g[TM_DSL_REGISTERED_KEY] = true
}

function buildKeywordSuggestions(
  words: string[],
  kind: monaco.languages.CompletionItemKind,
): Array<Pick<monaco.languages.CompletionItem, 'label' | 'kind' | 'insertText'>> {
  return words.map(word => ({
    label: word,
    kind,
    insertText: word,
  }))
}

interface CompletionTemplate {
  label: string
  kind: monaco.languages.CompletionItemKind
  insertText: string
  insertTextRules?: monaco.languages.CompletionItemInsertTextRule
  documentation?: string
}

interface TmSubsystemsResponse {
  subsystems?: string[]
}

interface TmPidMnemonic {
  pid: string
  mnemonic: string
  combined: string
}

interface TmMnemonicRecord {
  _id?: string
  cdbMnemonic?: string
  subsystem?: string
  type?: string
  range?: unknown
}

let subsystemsCache: string[] | null = null
const mnemonicsBySubsystemCache = new Map<string, string[]>()
const pidMnemonicBySubsystemCache = new Map<string, TmPidMnemonic[]>()
const tmRecordsBySubsystemCache = new Map<string, TmMnemonicRecord[]>()
let subsystemsRequest: Promise<string[]> | null = null
const mnemonicsRequestBySubsystem = new Map<string, Promise<string[]>>()
const pidMnemonicRequestBySubsystem = new Map<string, Promise<TmPidMnemonic[]>>()
const tmRecordsRequestBySubsystem = new Map<string, Promise<TmMnemonicRecord[]>>()

function snippetPlaceholder(value: string): string {
  return '$' + `{${value}}`
}

function sortUnique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

async function fetchSubsystems(): Promise<string[]> {
  if (subsystemsCache)
    return subsystemsCache

  if (subsystemsRequest)
    return subsystemsRequest

  subsystemsRequest = fetchJSON<TmSubsystemsResponse>('/telemetry/subsystems')
    .then((data) => {
      if (!data)
        return []
      return sortUnique((data.subsystems ?? []).map(v => String(v).trim().toUpperCase()))
    })
    .catch(() => [])
    .finally(() => {
      subsystemsRequest = null
    })

  subsystemsCache = await subsystemsRequest
  return subsystemsCache
}

async function fetchMnemonicsBySubsystem(subsystem: string): Promise<string[]> {
  const sub = subsystem.trim().toUpperCase()
  if (!sub)
    return []

  const cached = mnemonicsBySubsystemCache.get(sub)
  if (cached)
    return cached

  const pending = mnemonicsRequestBySubsystem.get(sub)
  if (pending)
    return pending

  const request = fetchPidMnemonicBySubsystem(sub)
    .then((rows) => {
      const names = rows.map(row => row.combined)
      return sortUnique(names)
    })
    .finally(() => {
      mnemonicsRequestBySubsystem.delete(sub)
    })

  mnemonicsRequestBySubsystem.set(sub, request)
  const resolved = await request
  mnemonicsBySubsystemCache.set(sub, resolved)
  return resolved
}

async function fetchPidMnemonicBySubsystem(subsystem: string): Promise<TmPidMnemonic[]> {
  const sub = subsystem.trim().toUpperCase()
  if (!sub)
    return []

  const cached = pidMnemonicBySubsystemCache.get(sub)
  if (cached)
    return cached

  const pending = pidMnemonicRequestBySubsystem.get(sub)
  if (pending)
    return pending

  const request = fetchJSON<Record<string, string>>(`/mnemonics/tm/id_to_mnemonic_mapping?subsystem=${encodeURIComponent(sub)}`)
    .then(async (data) => {
      const mapped = Object.entries(data ?? {})
        .map(([pid, mnemonic]) => {
          const id = String(pid ?? '').trim()
          const name = String(mnemonic ?? '').trim()
          if (!id || !name)
            return null
          return {
            pid: id,
            mnemonic: name,
            combined: `${id}_${name}`,
          } as TmPidMnemonic
        })
        .filter(Boolean) as TmPidMnemonic[]

      if (mapped.length > 0)
        return mapped.sort((a, b) => a.combined.localeCompare(b.combined))

      // Fallback: build PID_MNEMONIC from full records endpoint.
      const rows = await fetchTmRecordsBySubsystem(sub)
      const fallback = rows
        .map((row) => {
          const id = String(row._id ?? '').trim()
          const name = String(row.cdbMnemonic ?? '').trim()
          if (!id || !name)
            return null
          return {
            pid: id,
            mnemonic: name,
            combined: `${id}_${name}`,
          } as TmPidMnemonic
        })
        .filter(Boolean) as TmPidMnemonic[]

      return fallback.sort((a, b) => a.combined.localeCompare(b.combined))
    })
    .catch(() => [])
    .finally(() => {
      pidMnemonicRequestBySubsystem.delete(sub)
    })

  pidMnemonicRequestBySubsystem.set(sub, request)
  const resolved = await request
  pidMnemonicBySubsystemCache.set(sub, resolved)
  return resolved
}

async function fetchTmRecordsBySubsystem(subsystem: string): Promise<TmMnemonicRecord[]> {
  const sub = subsystem.trim().toUpperCase()
  if (!sub)
    return []

  const cached = tmRecordsBySubsystemCache.get(sub)
  if (cached)
    return cached

  const pending = tmRecordsRequestBySubsystem.get(sub)
  if (pending)
    return pending

  const request = fetchJSON<TmMnemonicRecord[]>(`/mnemonics/tm/${encodeURIComponent(sub)}`)
    .then((data) => {
      if (!data)
        return []
      return Array.isArray(data) ? data : []
    })
    .catch(() => [])
    .finally(() => {
      tmRecordsRequestBySubsystem.delete(sub)
    })

  tmRecordsRequestBySubsystem.set(sub, request)
  const resolved = await request
  tmRecordsBySubsystemCache.set(sub, resolved)
  return resolved
}

function normalizeRangeValues(range: unknown): string[] {
  if (!Array.isArray(range))
    return []
  return sortUnique(range.map(v => String(v).trim()).filter(Boolean))
}

async function fetchRangeValues(subsystem: string, mnemonic: string): Promise<string[]> {
  const sub = subsystem.trim().toUpperCase()
  const token = mnemonic.trim()
  if (!sub || !token)
    return []

  const firstUnderscore = token.indexOf('_')
  const pidFromToken = firstUnderscore > 0 ? token.slice(0, firstUnderscore).trim() : ''
  const mnemonicFromToken = firstUnderscore > 0 ? token.slice(firstUnderscore + 1).trim() : token

  const rows = await fetchTmRecordsBySubsystem(sub)
  const hit = rows.find((row) => {
    const cdb = String(row.cdbMnemonic ?? '').trim()
    const id = String(row._id ?? '').trim()
    const idMatch = pidFromToken
      ? id.localeCompare(pidFromToken, undefined, { sensitivity: 'accent' }) === 0
      : false
    const mnemonicMatch = cdb.localeCompare(mnemonicFromToken, undefined, { sensitivity: 'accent' }) === 0
    const directIdMatch = id.localeCompare(token, undefined, { sensitivity: 'accent' }) === 0
    const combinedMatch = `${id}_${cdb}`.localeCompare(token, undefined, { sensitivity: 'accent' }) === 0
    return idMatch || mnemonicMatch || directIdMatch || combinedMatch
  })

  if (!hit)
    return []

  return normalizeRangeValues(hit.range)
}

function toRangeSuggestions(
  items: string[],
  range: monaco.IRange,
  prefixSpace = false,
): monaco.languages.CompletionItem[] {
  return items.map((item, idx) => ({
    label: item,
    kind: monaco.languages.CompletionItemKind.Value,
    insertText: `${prefixSpace ? ' ' : ''}${item}`,
    range,
    detail: 'TM range value',
    sortText: `0_${String(idx).padStart(3, '0')}_${item}`,
  }))
}

function registerTmDslCompletions() {
  const g = globalThis as Record<string, unknown>
  if (g[TM_DSL_COMPLETION_REGISTERED_KEY])
    return

  const keywordItems = buildKeywordSuggestions(JULIA_KEYWORDS, monaco.languages.CompletionItemKind.Keyword)
  const dslItems = buildKeywordSuggestions(ASTRA_DSL_KEYWORDS, monaco.languages.CompletionItemKind.Keyword)
  const builtinItems = buildKeywordSuggestions(JULIA_BUILTINS, monaco.languages.CompletionItemKind.Function)

  const snippetItems: CompletionTemplate[] = [
    {
      label: 'if-end',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: [
        `if ${snippetPlaceholder('1:condition')}`,
        `  ${snippetPlaceholder('2')}`,
        'end',
      ].join('\n'),
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Julia if/end block',
    },
    {
      label: 'for-end',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: [
        `for ${snippetPlaceholder('1:item')} in ${snippetPlaceholder('2:items')}`,
        `  ${snippetPlaceholder('3')}`,
        'end',
      ].join('\n'),
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Julia for/end block',
    },
    {
      label: 'CHECK EXPECTED',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: [
        `CHECK ${snippetPlaceholder('1:mnemonic')}`,
        `EXPECTED ${snippetPlaceholder('2:condition')}`,
      ].join('\n'),
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'ASTRA CHECK + EXPECTED template',
    },
    {
      label: 'WAIT UNTIL',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: `WAIT ${snippetPlaceholder('1:seconds')} UNTIL ${snippetPlaceholder('2:condition')}`,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'ASTRA WAIT UNTIL template',
    },
  ]

  monaco.languages.registerCompletionItemProvider('tmDsl', {
    triggerCharacters: ['.', '_', ' ', '(', '$', '>', '<', '=', '!', '-'],
    async provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      const linePrefix = model.getLineContent(position.lineNumber).slice(0, Math.max(0, position.column - 1))

      // Pattern 1: "TM." or "TM.<partial>" -> suggest subsystem names from API.
      const tmSubsystemMatch = linePrefix.match(/(?:^|\W)TM\.(\w*)$/i)
      if (tmSubsystemMatch) {
        const partialSubsystem = (tmSubsystemMatch[1] ?? '').toUpperCase()
        const subsystems = await fetchSubsystems()
        const filteredSubsystems = partialSubsystem
          ? subsystems.filter(s => s.startsWith(partialSubsystem))
          : subsystems

        const dynamicRange: monaco.IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - (tmSubsystemMatch[1]?.length ?? 0),
          endColumn: position.column,
        }

        return {
          suggestions: filteredSubsystems.map((item, idx) => ({
            label: item,
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: `${item}.`,
            range: dynamicRange,
            sortText: `0_${String(idx).padStart(4, '0')}_${item}`,
            detail: 'TM subsystem',
            // Immediately open next suggestions for TM.<SUBSYSTEM>.<...>
            command: {
              id: 'editor.action.triggerSuggest',
              title: 'Trigger Suggest',
            },
          })),
        }
      }

      // Pattern 2: "TM.<SUBSYSTEM>." or "TM.<SUBSYSTEM>.<partial>" -> suggest PID_MNEMONIC via API.
      // On accept, rewrite expression to TM.PID_MNEMONIC (subsystem segment removed).
      const tmMnemonicMatch = linePrefix.match(/(?:^|\W)TM\.(\w+)\.([\w+-]*)$/i)
      if (tmMnemonicMatch) {
        const subsystem = (tmMnemonicMatch[1] ?? '').toUpperCase()
        const partialMnemonic = (tmMnemonicMatch[2] ?? '').toUpperCase()
        const mnemonics = await fetchMnemonicsBySubsystem(subsystem)
        const filteredMnemonics = partialMnemonic
          ? mnemonics.filter(m => m.toUpperCase().startsWith(partialMnemonic))
          : mnemonics

        const partialLen = tmMnemonicMatch[2]?.length ?? 0
        const partialRange: monaco.IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - partialLen,
          endColumn: position.column,
        }

        const expressionPrefix = `TM.${subsystem}.`
        const expressionStartColumn = position.column - (expressionPrefix.length + partialLen)
        const removePrefixEdit = expressionStartColumn >= 1
          ? [{
              range: {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: expressionStartColumn,
                endColumn: partialRange.startColumn,
              },
              text: '',
            }]
          : []

        return {
          suggestions: filteredMnemonics.map((item, idx) => ({
            label: item,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: `TM.${item}`,
            range: partialRange,
            additionalTextEdits: removePrefixEdit,
            sortText: `0_${String(idx).padStart(4, '0')}_${item}`,
            detail: 'TM PID_MNEMONIC reference',
          })),
        }
      }

      // Pattern 3a: TM.PID_MNEMONIC <op> <partial> -> suggest range values.
      const tmRangePidMatch = linePrefix.match(/(?:^|\W)TM\.([\w+-]+)\s*(==|!=|>=|<=|>|<)\s*([\w+\-.]*)$/i)
      if (tmRangePidMatch) {
        const tmToken = tmRangePidMatch[1] ?? ''
        const tokenParts = tmToken.split('_', 2)
        const subsystem = tokenParts[0]?.slice(0, 3).toUpperCase() ?? ''
        const partialValue = String(tmRangePidMatch[3] ?? '').toUpperCase()
        const rangeValues = await fetchRangeValues(subsystem, tmToken)
        const filteredValues = partialValue
          ? rangeValues.filter(v => v.toUpperCase().startsWith(partialValue))
          : rangeValues

        const dynamicRange: monaco.IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - (tmRangePidMatch[3]?.length ?? 0),
          endColumn: position.column,
        }
        const charBeforeStart = dynamicRange.startColumn > 1
          ? model.getValueInRange({
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: dynamicRange.startColumn - 1,
              endColumn: dynamicRange.startColumn,
            })
          : ''
        const needsLeadingSpace = !/^\s$/.test(charBeforeStart)

        return {
          suggestions: toRangeSuggestions(filteredValues, dynamicRange, needsLeadingSpace),
        }
      }

      // Pattern 3b: TM["PID_MNEMONIC"] <op> <partial> -> suggest range values.
      const tmRangeBracketMatch = linePrefix.match(/(?:^|\W)TM\["([^"]+)"\]\s*(==|!=|>=|<=|>|<)\s*([\w+\-.]*)$/i)
      if (tmRangeBracketMatch) {
        const tmToken = tmRangeBracketMatch[1] ?? ''
        const tokenParts = tmToken.split('_', 2)
        const subsystem = tokenParts[0]?.slice(0, 3).toUpperCase() ?? ''
        const partialValue = String(tmRangeBracketMatch[3] ?? '').toUpperCase()
        const rangeValues = await fetchRangeValues(subsystem, tmToken)
        const filteredValues = partialValue
          ? rangeValues.filter(v => v.toUpperCase().startsWith(partialValue))
          : rangeValues

        const dynamicRange: monaco.IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - (tmRangeBracketMatch[3]?.length ?? 0),
          endColumn: position.column,
        }
        const charBeforeStart = dynamicRange.startColumn > 1
          ? model.getValueInRange({
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: dynamicRange.startColumn - 1,
              endColumn: dynamicRange.startColumn,
            })
          : ''
        const needsLeadingSpace = !/^\s$/.test(charBeforeStart)

        return {
          suggestions: toRangeSuggestions(filteredValues, dynamicRange, needsLeadingSpace),
        }
      }

      // Pattern 3c (backward compatibility): "TM.<SUBSYSTEM>.<MNEMONIC> <op> <partial>" -> suggest range values.
      const tmRangeLegacyMatch = linePrefix.match(/(?:^|\W)TM\.(\w+)\.([\w+-]+)\s*(==|!=|>=|<=|>|<)\s*([\w+\-.]*)$/i)
      if (tmRangeLegacyMatch) {
        const subsystem = (tmRangeLegacyMatch[1] ?? '').toUpperCase()
        const mnemonic = tmRangeLegacyMatch[2] ?? ''
        const partialValue = String(tmRangeLegacyMatch[4] ?? '').toUpperCase()
        const rangeValues = await fetchRangeValues(subsystem, mnemonic)
        const filteredValues = partialValue
          ? rangeValues.filter(v => v.toUpperCase().startsWith(partialValue))
          : rangeValues

        const dynamicRange: monaco.IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - (tmRangeLegacyMatch[4]?.length ?? 0),
          endColumn: position.column,
        }
        const charBeforeStart = dynamicRange.startColumn > 1
          ? model.getValueInRange({
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: dynamicRange.startColumn - 1,
              endColumn: dynamicRange.startColumn,
            })
          : ''
        const needsLeadingSpace = !/^\s$/.test(charBeforeStart)

        return {
          suggestions: toRangeSuggestions(filteredValues, dynamicRange, needsLeadingSpace),
        }
      }

      const suggestions: monaco.languages.CompletionItem[] = [
        ...keywordItems,
        ...dslItems,
        ...builtinItems,
        ...snippetItems,
      ].map(item => ({
        ...item,
        range,
      }))

      return { suggestions }
    },
  })

  g[TM_DSL_COMPLETION_REGISTERED_KEY] = true
}

onMounted(() => {
  ensureMonacoWorkers()
  registerTmDslLanguage()
  registerTmDslCompletions()
})
</script>

<template>
  <MonacoEditor
    :model-value="props.modelValue"
    language="tmDsl"
    theme="vs-dark"
    :height="props.height"
    :options="editorOptions"
    @update:model-value="emit('update:modelValue', $event as string)"
  />
</template>
