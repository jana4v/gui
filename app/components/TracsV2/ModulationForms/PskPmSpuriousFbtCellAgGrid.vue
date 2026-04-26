<template>
  <div class="spurious-fbt-cell" @mousedown.stop @click.stop @contextmenu.stop>
    <div class="fbt-preview" :class="{ editable: isEditable }" @dblclick="openEditor">
      <table>
        <thead>
          <tr>
            <th>Offset (kHz)</th>
            <th>Value (dBc)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in tableData" :key="idx">
            <td>{{ formatValue(row[0]) }}</td>
            <td>{{ formatValue(row[1]) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="isEditable" class="edit-overlay">
        <i class="pi pi-pencil" />
      </div>
    </div>

    <Dialog
      v-model:visible="showDialog"
      modal
      :header="dialogTitle"
      :style="{ width: '620px' }"
      :dismissableMask="true"
    >
      <div class="editor-wrap">
        <HotTable :settings="hotSettings" :data="editingData" />
      </div>

      <template #footer>
        <Button label="Cancel" icon="pi pi-times" text @click="closeEditor" />
        <Button label="Save" icon="pi pi-check" @click="saveChanges" />
      </template>
    </Dialog>
  </div>
</template>

<script lang="ts" setup>
import { HotTable } from '@handsontable/vue3';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.css';
import 'handsontable/styles/ht-theme-main-no-icons.css';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';

registerAllModules();

type FbtMatrix = (string | number)[][];

const props = defineProps<{ params: any }>();

const ensureMatrix = (value: unknown): FbtMatrix => {
  if (Array.isArray(value) && value.length > 0 && value.every((row) => Array.isArray(row))) {
    return value as FbtMatrix;
  }
  return [['', '']];
};

const tableData = ref<FbtMatrix>(ensureMatrix(props.params?.value));
const editingData = ref<FbtMatrix>([]);
const showDialog = ref(false);

const isEditable = computed(() => props.params?.isEditable !== false);

watch(
  () => props.params?.value,
  (val) => {
    tableData.value = ensureMatrix(val);
  },
  { deep: true },
);

const dialogTitle = computed(() => {
  const field = props.params?.colDef?.field;
  const displayName = field === 'fbt' ? 'FBT' : field === 'fbt_hot' ? 'FBT Hot' : 'FBT Cold';

  const row = (props.params?.data ?? {}) as Record<string, unknown>;
  const code = String(row.code ?? '').trim();
  const port = String(row.port ?? '').trim();
  const frequencyLabel = String(row.frequency_label ?? row.frequency ?? '').trim();

  const rowIdentity = [code, port, frequencyLabel]
    .filter((v) => v.length > 0)
    .join('_');

  if (rowIdentity.length > 0) {
    return `Edit ${displayName} - ${rowIdentity}`;
  }

  return `Edit ${displayName} - Row ${(props.params?.node?.rowIndex ?? 0) + 1}`;
});

function formatValue(val: string | number | undefined): string {
  if (val === '' || val === null || val === undefined) return '-';
  if (typeof val === 'number') return val.toFixed(2);
  return String(val);
}

function openEditor() {
  if (!isEditable.value) return;
  editingData.value = JSON.parse(JSON.stringify(tableData.value));
  showDialog.value = true;
}

function closeEditor() {
  showDialog.value = false;
}

async function saveChanges() {
  const cleanedData = editingData.value.filter((row) =>
    row.some((cell) => cell !== '' && cell !== null && cell !== undefined),
  );
  const finalData = cleanedData.length > 0 ? cleanedData : [['', '']];

  const field = props.params?.colDef?.field;
  if (field && props.params?.node) {
    props.params.node.setDataValue(field, finalData);
    tableData.value = finalData;

    await nextTick();

    setTimeout(() => {
      props.params?.api?.resetRowHeights();
      props.params?.api?.onRowHeightChanged?.();
      props.params?.api?.refreshCells?.({ force: true });
    }, 0);
  }

  showDialog.value = false;
}

const hotSettings = computed(() => ({
  licenseKey: 'non-commercial-and-evaluation',
  colHeaders: ['Offset (kHz)', 'Value (dBc)'],
  columns: [
    {
      type: 'numeric',
      locale: 'en-US',
      numericFormat: {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true,
      },
    },
    {
      type: 'numeric',
      locale: 'en-US',
      numericFormat: {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true,
      },
    },
  ],
  rowHeaders: true,
  stretchH: 'all',
  width: '100%',
  minRows: 1,
  minSpareRows: 1,
  contextMenu: true,
  height: 380,
  autoWrapRow: true,
  autoWrapCol: true,
  copyPaste: true,
  fillHandle: {
    direction: 'vertical',
    autoInsertRow: true,
  },
  enterMoves: { row: 1, col: 0 },
  tabMoves: { row: 0, col: 1 },
}));
</script>

<style>
.spurious-fbt-cell {
  width: 100% !important;
  height: 100% !important;
  padding: 2px 0 !important;
}

.fbt-preview {
  position: relative;
  width: 100% !important;
  border: 1px solid rgba(148, 163, 184, 0.45) !important;
  border-radius: 2px !important;
  overflow: auto !important;
  max-height: 168px;
  background: var(--surface-0) !important;
}

.fbt-preview.editable {
  cursor: pointer !important;
}

.fbt-preview.editable:hover {
  border-color: var(--primary-color) !important;
}

.fbt-preview table {
  width: 100% !important;
  border-collapse: collapse !important;
  table-layout: fixed !important;
  font-variant-numeric: tabular-nums;
}

.fbt-preview thead th {
  background: rgba(148, 163, 184, 0.12) !important;
  color: var(--text-color-secondary) !important;
  font-size: 0.68rem !important;
  font-weight: 600 !important;
  text-align: left !important;
  line-height: 1.1 !important;
  padding: 2px 4px !important;
  border-bottom: 1px solid rgba(148, 163, 184, 0.45) !important;
  border-right: 1px solid rgba(148, 163, 184, 0.35) !important;
}

.fbt-preview tbody td {
  padding: 1px 4px !important;
  font-size: 0.7rem !important;
  line-height: 1.2 !important;
  color: var(--text-color) !important;
  border-bottom: 1px solid rgba(148, 163, 184, 0.38) !important;
  border-right: 1px solid rgba(148, 163, 184, 0.30) !important;
}

.fbt-preview thead th:last-child,
.fbt-preview tbody td:last-child {
  border-right: none !important;
}

.edit-overlay {
  position: absolute !important;
  top: 4px !important;
  right: 4px !important;
  font-size: 0.72rem !important;
  color: var(--primary-color) !important;
  opacity: 0 !important;
  transition: opacity 0.15s ease !important;
  pointer-events: none !important;
}

.fbt-preview.editable:hover .edit-overlay {
  opacity: 1 !important;
}

.editor-wrap {
  margin: 0.75rem 0;
}

.handsontable.htContextMenu {
  background: #111827 !important;
  border: 1px solid #334155 !important;
  color: #e2e8f0 !important;
  z-index: 10000 !important;
}

.handsontable.htContextMenu table tbody tr td {
  background: #111827 !important;
  color: #e2e8f0 !important;
}

.handsontable.htContextMenu table tbody tr:hover td,
.handsontable.htContextMenu table tbody tr.current td {
  background: #1e293b !important;
  color: #f8fafc !important;
}
</style>
