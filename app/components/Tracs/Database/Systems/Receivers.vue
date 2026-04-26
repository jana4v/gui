<script setup>
import { useToast } from 'primevue/usetoast'
import receiver from '@/components/Tracs/Database/Systems/ReceiverDetails.vue'

const toast = useToast()

const components = ref([{ name: '', data: '' }])

const rx_names_and_code = ref({ names: [], codes: [] })
provide('rx_names_and_code', rx_names_and_code)

function add_receiver() {
  components.value.push({ name: markRaw(receiver), data: {} })
}

async function get_data_from_api() {
  components.value = []
  const res = await useAPIFetch('tracs/getReceivers')
  const rx_names = []
  const tx_codes = []
  if (res.error.value == null) {
    res.data.value.forEach((data) => {
      rx_names.push(data.name)
      tx_codes.push(data.code)
    })
    rx_names_and_code.value = { names: rx_names, codes: tx_codes }
    res.data.value.forEach((data) => {
      components.value.push({ name: markRaw(receiver), data })
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
    <Button class="mx-2" @click="add_receiver">
      Add Recceiver
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
