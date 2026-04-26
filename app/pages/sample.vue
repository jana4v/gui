<script setup>
const { $indexedDB } = useNuxtApp()
const data = ref(null)

async function fetchData() {
  data.value = await $indexedDB.getDataByKey(1)
}
</script>

<template>
</template>
