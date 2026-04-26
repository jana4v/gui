<script setup>
import { ref } from 'vue'

const rows = ref([])

function addNewRow() {
  rows.value.push({
    id: Date.now(), // unique id for each new row
    data: 'Hello',
    editing: true,
  })
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
        Down Link Ports
      </h5>
      <Button icon="pi pi-plus" severity="success" rounded aria-label="Add" @click="addNewRow" />
    </div>
    <DataTable :value="rows">
      <Column field="data" header="Data">
        <template #body="slotProps">
          <div class="flex align-items-center justify-content-between">
            <div>
              <InputText v-if="slotProps.data.editing" v-model="slotProps.data.data" />
              <span v-else>{{ slotProps.data.data }}</span>
            </div>
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
