<script setup lang="ts">
import { computed } from "vue";
import { ElDatePicker, ElInput, ElInputNumber } from "element-plus";

import type { SystemFormField } from "./system-types.js";
import type { SystemOption } from "@guanxiangkai/platform-client";

const props = withDefaults(
  defineProps<{
    field: SystemFormField;
    modelValue?: unknown;
    options?: readonly SystemOption[];
  }>(),
  {
    options: () => [],
  },
);

const emit = defineEmits<{ "update:modelValue": [value: string | number | null] }>();

const textValue = computed({
  get: () => (typeof props.modelValue === "string" ? props.modelValue : ""),
  set: (value: string) => emit("update:modelValue", value),
});
const numberValue = computed({
  get: () => (typeof props.modelValue === "number" ? props.modelValue : null),
  set: (value: number | null | undefined) => emit("update:modelValue", value ?? null),
});
</script>

<template>
  <ElInput
    v-if="field.type === 'text'"
    v-model="textValue"
    clearable
    maxlength="255"
    :placeholder="field.placeholder ?? ''"
  />
  <ElInput
    v-else-if="field.type === 'textarea'"
    v-model="textValue"
    type="textarea"
    :rows="3"
    maxlength="500"
    show-word-limit
    :placeholder="field.placeholder ?? ''"
  />
  <ElInputNumber
    v-else-if="field.type === 'number'"
    v-model="numberValue"
    :min="field.min ?? 0"
    :max="field.max ?? Number.MAX_SAFE_INTEGER"
    controls-position="right"
    style="width: 100%"
  />
  <ElDatePicker
    v-else-if="field.type === 'datetime'"
    v-model="textValue"
    type="datetime"
    value-format="YYYY-MM-DDTHH:mm:ss"
    placeholder="选择日期时间"
    style="width: 100%"
  />
  <select
    v-else
    v-model="textValue"
    class="system-native-select"
    :aria-label="`选择${field.label}`"
  >
    <option value="">不选择表示顶级</option>
    <option
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :disabled="option.disabled"
    >
      {{ option.label }}
    </option>
  </select>
</template>
