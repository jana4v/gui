<script setup>
import { useToast } from 'primevue/usetoast'
import transmitter from '@/components/Tracs/Database/Systems/TransmitterDetails.vue'

const toast = useToast()
const components = ref([{ name: '', data: '' }])

const tx_names_and_code = ref({ names: [], codes: [] })
provide('tx_names_and_code', tx_names_and_code)

function add_transmitter() {
  components.value.push({ name: markRaw(transmitter), data: {} })
}

async function get_data_from_api() {
  components.value = []
  const res = await useAPIFetch('tracs/getTransmitters')

  const tx_names = []
  const tx_codes = []
  if (res.error.value == null) {
    res.data.value.forEach((data) => {
      tx_names.push(data.name)
      tx_codes.push(data.code)
    })
    tx_names_and_code.value = { names: tx_names, codes: tx_codes }
    res.data.value.forEach((data) => {
      components.value.push({ name: markRaw(transmitter), data })
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
    <Button class="mx-2" @click="add_transmitter">
      Add Transmitter
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
