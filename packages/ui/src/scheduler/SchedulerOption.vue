<script setup lang="ts">
import { ElOption } from "element-plus";
import { defineComponent, h, type Component } from "vue";

/**
 * 为 Element Plus 选项提供稳定的字符串属性边界。
 *
 * Element Plus 的内部属性描述符不应泄漏到业务表单和筛选组件。
 */
interface Props {
  /** 选项显示文本。 */
  label: string;
  /** 选项提交的字符串值。 */
  value: string;
  /** 是否禁用该选项。 */
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), { disabled: false });

const ElementOption = defineComponent({
  name: "SchedulerOption",
  props: {
    label: { type: String, required: true },
    value: { type: String, required: true },
    disabled: Boolean,
  },
  setup(optionProps, { slots }) {
    return () => h(ElOption as Component, optionProps, slots);
  },
});
</script>

<template>
  <ElementOption v-bind="props"><slot /></ElementOption>
</template>
