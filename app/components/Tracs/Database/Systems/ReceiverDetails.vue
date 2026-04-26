<script lang='ts' setup>
import InlineMessage from 'primevue/inlinemessage'
import * as yup from 'yup'
import CDMA from '@/components/Tracs/ModulationForms/CDMA.vue'
import FormNotFound from '@/components/Tracs/ModulationForms/FormNotFound.vue'
import PskFm from '@/components/Tracs/ModulationForms/PskFM.vue'
import { useAPIFetch } from '@/composables/restApi'

interface DataPropType {
  name: string
  code: string
  modulation_type: string
  modulation_details: any
  id: string
}
type EventFunction = (event: any) => void

const props = defineProps({
  data: {
    type: Object as () => DataPropType,
    default: () => ({
      name: 'C Receiver 1',
      code: 'CTX1',
      modulation_type: '',
      modulation_details: {},
      id: '',
    }),
  },
  onEvent: {
    type: Function as PropType<EventFunction>,
  },
})

const name = props.data?.name ? props.data.name : ''
const code = props.data?.code ? props.data.code : ''
const modulation_type = props.data?.modulation_type ? props.data.modulation_type : ''
const is_new_tx = !props.data?.name

const name_validator = yup.string().matches(/^[a-z][a-z0-9 ]{4,}[a-z0-9]$/i)
const code_validator = yup.string().matches(/^[a-z][a-z0-9]{2,}$/i)

const modulation_form = ref(null)
const selectedModulationType = ref()
const receiver_name = ref(name)
const rx_name_err_msg = ref('')
const receiver_code = ref(code)
const rx_code_err_msg = ref('')
const placeholder = ref(' Select Modulation Type')
const downLinkModulationTypes = ref([])
const ports = ref([{ port: 'EV', code: 'EV' }, { port: 'AEV', code: 'AEV' }, { port: 'GLOBAL', code: 'GLOBAL' }])
const selectedPort = ref('')
const opoptions = ref([])
const option = ref({})
const isEditable = ref(false)
const componentKey = ref(0)
const is_form_not_found = ref(false)
const modulation_component_name = ref()
const modulation_form_not_found = ref(false)

watch(modulation_form_not_found, (newValue) => {
  if (newValue) {
    setTimeout(() => {
      modulation_form_not_found.value = false
    }, 3000)
  }
})

provide('isEditable', computed(() => isEditable.value))

onMounted(async () => {
  isEditable.value = !props.data?.code
  afterGuiAttached()
  selectedModulationType.value = modulation_type
})

function afterGuiAttached() {
  useAPIFetch('tracs/getModulationTypes').then((res) => {
    if (res.error.value == null && res.data.value.length > 0) {
      downLinkModulationTypes.value = res.data.value.map((opt: any) => ({ value: opt }))
    }
  })
}

function rest_api_save(rx_data: any) {
  useAPIFetch('tracs/saveReceiverData', { method: 'post', body: rx_data }).then((res) => {
    if (res.error.value == null) {
      props.onEvent({ severity: 'success', summary: 'Status', detail: 'Database Updated', life: 3000 })
    }
    else {
      props.onEvent({ severity: 'error', summary: 'Error', detail: 'Failed to Update Database', life: 5000 })
    }
  })
}

function delete_record() {
  useAPIFetch(`tracs/deleteReceiverData/${receiver_code.value}`, { method: 'delete' }).then((res) => {
    if (res.error.value == null) {
      props.onEvent({ severity: 'success', summary: 'Status', detail: 'Record Deleteted From Database', life: 3000 })
    }
    else {
      props.onEvent({ severity: 'error', summary: 'Error', detail: 'Failed to Delete Record From Database', life: 5000 })
    }
  })
}

watch(selectedModulationType, async (new_value, old_value) => {
  if (new_value == 'PSK_FM') {
    modulation_component_name.value = markRaw(PskFm)
    is_form_not_found.value = false
  }
  else if (new_value == 'FSK_FM') {
    modulation_component_name.value = markRaw(CDMA)
    is_form_not_found.value = false
  }
  else {
    modulation_component_name.value = markRaw(FormNotFound)
    is_form_not_found.value = true
  }
})

const names_and_code = inject('rx_names_and_code', { names: [''], codes: [''] })

async function save() {
  const names_and_code_local = JSON.parse(JSON.stringify(names_and_code.value))
  const name_index = names_and_code_local.names.indexOf(name)
  if (name_index != -1)
    names_and_code_local.names.splice(name_index, 1)
  const code_index = names_and_code_local.codes.indexOf(code)
  if (code_index != -1)
    names_and_code_local.codes.splice(code_index, 1)

  console.log(names_and_code_local)

  if (is_form_not_found.value == true) {
    modulation_form_not_found.value = true
  }

  if (names_and_code_local.names.includes(receiver_name.value)) {
    rx_name_err_msg.value = 'Receiver name already exists'
    return
  }
  else { rx_name_err_msg.value = '' }

  if (names_and_code_local.codes.includes(receiver_code.value)) {
    rx_code_err_msg.value = 'Receiver code already exists'
    return
  }

  if (is_form_not_found.value)
    return
  const rx_name_is_valid = await name_validator.isValid(receiver_name.value)
  const rx_code_is_valid = await code_validator.isValid(receiver_code.value)
  if (!rx_name_is_valid) {
    rx_name_err_msg.value = 'Atleast 3 characters required'
  }
  else { rx_name_err_msg.value = '' }
  if (!rx_code_is_valid) {
    rx_code_err_msg.value = 'Atleast 3 characters required(Space not allowed)'
  }
  else { rx_code_err_msg.value = '' }

  const data = {
    name: receiver_name.value,
    code: receiver_code.value,
    modulation: selectedModulationType.value,
    modulation_details: modulation_form.value.get_data(),
  }
  console.log(data)

  if (rx_name_err_msg.value.length == 0 && rx_code_err_msg.value.length == 0 && modulation_form_not_found.value == false) {
    rest_api_save(data)
    isEditable.value = false
    componentKey.value += 1
  }
}

function edit() {
  isEditable.value = true
  componentKey.value += 1
}
</script>

<template>
  <div>
    <div class="grid mt-1">
      <p class="mb-0 text-2xl w-10 font-semibold text-cyan-400">
        Receiver
      </p>
      <div class="col-4">
        <p class="mb-0 text-xl w-10">
          Name
        </p>
        <InputText
          id="receiver_name" v-model="receiver_name" placeholder="Example: C Receiver 1" type="text"
          :class="{ 'p-invalid': rx_name_err_msg }" aria-describedby="text-error" :disabled="!isEditable"
        />
        <div><span id="text-error" class="p-error">{{ rx_name_err_msg || '&nbsp;' }}</span></div>
      </div>
      <div class="col-4">
        <p class="mb-0 text-xl w-10">
          Code
        </p>
        <InputText
          id="receiver_code" v-model="receiver_code" :disabled="!isEditable" placeholder="Example: CRX1"
          type="text" :class="{ 'p-invalid': rx_code_err_msg }" aria-describedby="text-error"
        />
        <div><span id="text-error" class="p-error">{{ rx_code_err_msg || '&nbsp;' }}</span></div>
      </div>
      <div class="col-4">
        <p class="mb-0 text-xl w-10">
          Modulation
        </p>
        <Dropdown
          v-model="selectedModulationType" :disabled="!isEditable" :options="downLinkModulationTypes" filter
          input-id="select_modulation_type" option-label="value" option-value="value" :placeholder="placeholder"
          class="w-full"
        />
      </div>
    </div>

    <div class="grid mt-0">
      <div class="col-12">
        <component :is="modulation_component_name" ref="modulation_form" :data="props.data.modulation_details" />
        <!-- <tracs-modulation-forms-psk-pm :isEditable="isEditable" :key="componentKey" v-if="selectedModulationType.value == 'psk_pm'"></tracs-modulation-forms-psk-pm>
            <tracs-modulation-forms-cdma v-if="selectedModulationType.value == 'fsk'"></tracs-modulation-forms-cdma> -->
      </div>
    </div>
    <div class="pb-5">
      <InlineMessage v-if="modulation_form_not_found" severity="error">
        Select Modulation Type before saving
      </InlineMessage>
    </div>
    <div class="grid p-buttonset">
      <Button v-if="isEditable" label="Save" icon="pi pi-check" @click="save" />
      <Button v-if="!isEditable" label="Edit" icon="pi pi-pencil" @click="edit" />
      <Button label="Delete" icon="pi pi-trash" @click="delete_record" />
    </div>
  </div>
</template>
