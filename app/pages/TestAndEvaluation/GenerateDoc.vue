<script setup>
import { ref } from 'vue'
import { initMenu, wamp_topic } from '@/composables/TandE/SideNav.ts'
// import { useDownloadBase64File } from "@/composables/useDownloadBase64File.ts";
definePageMeta({
  title: 'Test And Evaluation',
})
initMenu(2)
const excelOptions = ref([])
const selectedExcels = ref([])
const docx = ref()
const docxUrl = `http://${window.location.hostname}/file_n/report.docx`
rpc('com.te.get_excel_names').then(async (res) => {
  excelOptions.value = res.map(opt => ({ v: opt }))
  selectedExcels.value = toRaw(excelOptions.value)
})

function generate_document() {
  rpc('com.te.generate_doc', [{
    type: 'generate_document',
    selected_excels: selectedExcels.value.map(opt => opt.v),
  }]).then(
    async (res) => {
      if (res?.error != null) {
        const msg = {
          summary: 'Failed to Generate Document',
          status: `Error:${res.error}`,
          progress: '0',
        }
        wamp_publish(wamp_topic, [], msg)
      }
      else {
        // console.log(res.data)
        docx.value.click()
      }
    },
  )
}

function abort_test() {
  rpc('com.te.abort', [{
    type: 'abort_test',
    sensor_name: 'no sensor',
  }])
}
const doc = ref(null)
</script>

<template>
  <AppName appname="Test And Evaluation" />
  <div class="flex mt-10 gap-6">
    <div class="w-1/4">
      <label text-cyan-300> Select Excels </label>
      <MultiSelect
        v-model="selectedExcels" class="w-full" :options="excelOptions" option-label="v" filter placeholder="Select Data Excels"
        :max-selected-labels="3"
      />
    </div>
  </div>

  <div class="flex gap-4 mt-8">
    <div class="w-1/6">
      <Button class="w-full" label="Generate Document" severity="primary" raised @click="generate_document" />
    </div>
    <div class="w-1/6">
      <Button class="w-full" label="Abort" severity="warn" raised @click="abort_test" />
    </div>
  </div>
  <a ref="docx" :href="docxUrl" />

  <div class="flex">
    <div class="w-full">
      <ExecutionStatus :topic="wamp_topic" />
    </div>
  </div>
  <div ref="doc" class="for_doc_down_load" />
</template>
