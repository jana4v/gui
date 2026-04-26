<script setup>
import { ref } from 'vue'

const props = defineProps({
  title: String,
  colDefs: Array,
})

const rows = ref([])

function get_row_template() {
  const row_template = {
    id: Date.now(), // unique id for each new row
    editing: true,
  }
  props.colDefs.forEach((element, index) => {
    row_template[element.field] = ''
  })
  return row_template
}

function addNewRow() {
  rows.value.push(get_row_template())
}
function editRow(row) {
  row.editing = true
}
function saveRow(row) {
  row.editing = false
}
function deleteRow(row) {
  rows.value = rows.value.filter(r => r !== row)
}
</script>

<template>
  <div class="card">
    <div class="flex align-items-center justify-content-between">
      <h5 class="mb-2">
        {{ title }}
      </h5>
      <Button icon="pi pi-plus" severity="success" rounded aria-label="Add" @click="addNewRow" />
    </div>
    <DataTable :value="rows">
      <Column v-for="col in colDefs" :key="col" :field="col.field" :header="col.header">
        <template #body="slotProps">
          <div class="flex align-items-center justify-content-between">
            <div>
              <InputText v-if="slotProps.data.editing" v-model="slotProps.data[col.field]" />
              <span v-else>{{ slotProps.data[col.field] }}</span>
            </div>
          </div>
        </template>
      </Column>

      <Column field="data">
        <template #body="slotProps">
          <div class="flex align-items-center justify-content-between">
            <div>
              <Button
                v-if="!slotProps.data.editing" icon="pi pi-pencil" severity="success" text rounded
                aria-label="Edit" @click="() => editRow(slotProps.data)"
              />
              <Button
                v-if="slotProps.data.editing" icon="pi pi-check" severity="success" text rounded
                aria-label="Save" @click="() => saveRow(slotProps.data)"
              />
              <Button
                icon="pi pi-trash" severity="success" text rounded aria-label="Delete"
                class="p-button-danger" @click="() => deleteRow(slotProps.data)"
              />
            </div>
          </div>
        </template>
      </Column>
    </DataTable>
  </div>
</template>
