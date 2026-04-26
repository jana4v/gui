<script setup lang="ts">
import MonacoEditor from '@guolao/vue-monaco-editor'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import { onMounted, watch } from 'vue'

interface MnemonicItem {
  mnemonic: string
  valueSuggestions?: string[]
  defaultValue?: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  mnemonics?: MnemonicItem[]
  height?: string
}>(), {
  height: '42vh',
  mnemonics: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const WORKER_KEY = '__tmConditionMonacoWorkerRegistered__'
const LANG_KEY = '__tmConditionLanguageRegistered__'
const COMPLETION_KEY = '__tmConditionCompletionRegistered__'
const LANGUAGE_ID = 'tmConditionLogic'

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
  wordBasedSuggestions: 'off',
}

function ensureMonacoWorkers() {
  if (!import.meta.client)
    return

  const g = globalThis as Record<string, any>
  if (g[WORKER_KEY])
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

  g[WORKER_KEY] = true
}

function registerLanguage() {
  const g = globalThis as Record<string, any>
  if (g[LANG_KEY])
    return

  if (!monaco.languages.getLanguages().some(lang => lang.id === LANGUAGE_ID)) {
    monaco.languages.register({ id: LANGUAGE_ID })

    monaco.languages.setLanguageConfiguration(LANGUAGE_ID, {
      brackets: [['(', ')']],
      autoClosingPairs: [
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
      ],
      surroundingPairs: [
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: '\'', close: '\'' },
      ],
    })

    monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, {
      tokenizer: {
        root: [
          [/\b(?:AND|OR|NOT)\b/i, 'keyword'],
          [/&&|\|\||!/, 'keyword'],
          [/==|!=|>=|<=|>|</, 'operator'],
          [/\b-?\d+(?:\.\d+)?\b/, 'number'],
          [/"[^"\\]*(?:\\.[^"\\]*)*"/, 'string'],
          [/'[^'\\]*(?:\\.[^'\\]*)*'/, 'string'],
          [/[A-Z_][\w:.+-]*/i, 'variable'],
          [/\(|\)/, 'delimiter.parenthesis'],
          [/\s+/, 'white'],
        ],
      },
    } as monaco.languages.IMonarchLanguage)
  }

  g[LANG_KEY] = true
}

function normalizeMnemonicMap() {
  const map = new Map<string, string[]>()

  for (const item of props.mnemonics) {
    const key = String(item.mnemonic || '').trim()
    if (!key)
      continue

    const values = [
      ...(item.valueSuggestions || []).map(v => String(v).trim()).filter(Boolean),
      String(item.defaultValue || '').trim(),
    ].filter(Boolean)

    const dedup = Array.from(new Set(values))
    map.set(key, dedup)
  }

  return map
}

function buildBaseSuggestions(range: monaco.IRange): monaco.languages.CompletionItem[] {
  const operatorSuggestions = [
    { label: 'AND', insertText: ' AND ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Logical operator' },
    { label: 'OR', insertText: ' OR ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Logical operator' },
    { label: 'NOT', insertText: 'NOT ', kind: monaco.languages.CompletionItemKind.Keyword, detail: 'Logical operator' },
    { label: '==', insertText: ' == ', kind: monaco.languages.CompletionItemKind.Operator, detail: 'Equals' },
    { label: '!=', insertText: ' != ', kind: monaco.languages.CompletionItemKind.Operator, detail: 'Not equals' },
    { label: '>=', insertText: ' >= ', kind: monaco.languages.CompletionItemKind.Operator, detail: 'Greater or equal' },
    { label: '<=', insertText: ' <= ', kind: monaco.languages.CompletionItemKind.Operator, detail: 'Less or equal' },
    { label: '>', insertText: ' > ', kind: monaco.languages.CompletionItemKind.Operator, detail: 'Greater than' },
    { label: '<', insertText: ' < ', kind: monaco.languages.CompletionItemKind.Operator, detail: 'Less than' },
  ]

  const mnemonicSuggestions = props.mnemonics.map((item, idx) => ({
    label: item.mnemonic,
    kind: monaco.languages.CompletionItemKind.Variable,
    insertText: item.mnemonic,
    detail: 'Telemetry mnemonic',
    sortText: `0_${String(idx).padStart(4, '0')}_${item.mnemonic}`,
    range,
  }))

  const operatorItems = operatorSuggestions.map((item, idx) => ({
    ...item,
    range,
    sortText: `2_${String(idx).padStart(4, '0')}_${item.label}`,
  }))

  return [...mnemonicSuggestions, ...operatorItems]
}

function buildValueSuggestions(linePrefix: string, range: monaco.IRange): monaco.languages.CompletionItem[] {
  const mnemonicMap = normalizeMnemonicMap()

  const quotedMatch = linePrefix.match(/([A-Z_][\w:.+-]*)\s*(==|!=|>=|<=|>|<)\s*(["'])([^"']*)$/i)
  const unquotedMatch = linePrefix.match(/([A-Z_][\w:.+-]*)\s*(==|!=|>=|<=|>|<)\s*([\w.+-]*)$/i)

  let mnemonic = ''
  let partial = ''
  let quote: '"' | '\'' | '' = ''

  if (quotedMatch) {
    mnemonic = quotedMatch[1] || ''
    partial = quotedMatch[4] || ''
    quote = (quotedMatch[3] as '"' | '\'') || '"'
  }
  else if (unquotedMatch) {
    mnemonic = unquotedMatch[1] || ''
    partial = unquotedMatch[3] || ''
  }

  if (!mnemonic)
    return []

  const values = mnemonicMap.get(mnemonic) || []
  if (!values.length)
    return []

  const filtered = partial
    ? values.filter(v => v.toLowerCase().startsWith(partial.toLowerCase()))
    : values

  return filtered.map((value, idx) => {
    const isNumeric = /^-?\d+(?:\.\d+)?$/.test(value)
    const insertText = quote
      ? `${value}${quote}`
      : isNumeric
        ? value
        : `'${value}'`

    return {
      label: value,
      kind: monaco.languages.CompletionItemKind.Value,
      insertText,
      detail: `Allowed value for ${mnemonic}`,
      range,
      sortText: `1_${String(idx).padStart(4, '0')}_${value}`,
    }
  })
}

function registerCompletions() {
  const g = globalThis as Record<string, any>
  if (g[COMPLETION_KEY])
    return

  monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
    triggerCharacters: [' ', '_', '.', ':', '=', '!', '>', '<', '\'', '"'],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position)
      const range: monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      const linePrefix = model.getLineContent(position.lineNumber).slice(0, Math.max(0, position.column - 1))
      const valueSuggestions = buildValueSuggestions(linePrefix, range)

      if (valueSuggestions.length > 0) {
        return { suggestions: valueSuggestions }
      }

      return { suggestions: buildBaseSuggestions(range) }
    },
  })

  g[COMPLETION_KEY] = true
}

watch(
  () => props.mnemonics,
  () => {
    // Suggestions are read from props on each completion request.
  },
  { deep: true },
)

onMounted(() => {
  ensureMonacoWorkers()
  registerLanguage()
  registerCompletions()
})
</script>

<template>
  <MonacoEditor
    :model-value="props.modelValue"
    :language="LANGUAGE_ID"
    theme="vs-dark"
    :height="props.height"
    :options="editorOptions"
    @update:model-value="emit('update:modelValue', $event as string)"
  />
</template>
