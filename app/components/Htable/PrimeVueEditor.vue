<script>
import InputText from 'primevue/inputtext'
import { ref } from 'vue'

export default {
  components: {
    InputText,
  },
  props: {
    initialValue: String,
    onUpdateValue: Function,
    onBlur: Function,
  },
  setup(props, { emit }) {
    const value = ref(props.initialValue)

    const onInput = (event) => {
      value.value = event.target.value
      props.onUpdateValue(value.value)
    }

    const onBlur = () => {
      if (props.onBlur) {
        props.onBlur()
      }
    }

    return {
      value,
      onInput,
      onBlur,
    }
  },
}
</script>

<template>
  <div>
    <InputText
      ref="input"
      v-model="value"
      @input="onInput"
      @blur="onBlur"
    />
  </div>
</template>
