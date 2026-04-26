<script setup>
import { useToast } from 'primevue/usetoast'
import transponder from '@/components/Tracs/Database/Systems/TransponderDetails.vue'

const toast = useToast()

const components = ref([{ name: '', data: '' }])

const tp_names_and_code = ref({ names: [], codes: [] })
provide('tp_names_and_code', tp_names_and_code)

function add_transponder() {
  components.value.push({ name: markRaw(transponder), data: {} })
}

async function get_data_from_api() {
  components.value = []
  const res = await useAPIFetch('tracs/systems/transponder/get')
  const tp_names = []
  const tp_codes = []
  if (res.error.value == null) {
    res.data.value.forEach((data) => {
      tp_names.push(data.name)
      tp_codes.push(data.code)
    })
    tp_names_and_code.value = { names: tp_names, codes: tp_codes }
    res.data.value.forEach((data) => {
      console.log(data)
      components.value.push({ name: markRaw(transponder), data })
    })
  }
  counter.value += 1
}

onMounted(async () => {
  await get_data_from_api()
})

const counter = ref(0)
async function cb_for_child(data) {
  await get_data_from_api()
  toast.add(data)
}
</script>

<template>
  <div :key="counter">
    <Button class="mx-2" @click="add_transponder">
      Add Transponder
    </Button>
    <Toast />
    <ScrollPanel style="height: calc(100vh - 18rem);padding: 0.5rem;">
      <div v-for="(component, index) in components" :key="index">
        <component
          :is="component.name" v-if="component.name != ''" :on-event="cb_for_child" class="card m-4"
          :data="component.data"
        />
      </div>
    </ScrollPanel>
  </div>
</template>
