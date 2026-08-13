import { ElOption } from "element-plus";
import { defineComponent, h, type Component } from "vue";

/**
 * 在公共组件边界包装 Element Plus 下拉选项，避免各页面重复声明运行时属性。
 *
 * @author guanxiangkai
 * @since 1.0.0
 */
export const AgentSelectOption = defineComponent({
  name: "AgentSelectOption",
  props: {
    label: { type: String, required: true },
    value: { type: String, required: true },
  },
  setup(props, { slots }) {
    return () => h(ElOption as Component, props, slots);
  },
});
