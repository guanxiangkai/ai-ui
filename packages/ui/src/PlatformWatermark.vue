<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import type { PlatformWatermarkProps } from "./component-types.js";
import { createUserWatermarkText } from "./watermark/user-watermark.js";

const props = withDefaults(defineProps<PlatformWatermarkProps>(), {
  department: "",
  name: "",
  enabled: true,
  color: "#475569",
  opacity: 0.08,
  fontSize: 16,
  rotate: -24,
  columns: 4,
  rows: 6,
  zIndex: 4000,
});

function finiteNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number, fallback: number): number {
  return Math.min(maximum, Math.max(minimum, finiteNumber(value, fallback)));
}

function positiveInteger(value: number, maximum: number, fallback: number): number {
  return Math.round(clamp(value, 1, maximum, fallback));
}

const text = computed(() => createUserWatermarkText(props.department, props.name));
const columns = computed(() => positiveInteger(props.columns, 12, 4));
const rows = computed(() => positiveInteger(props.rows, 12, 6));
const cells = computed(() =>
  Array.from({ length: columns.value * rows.value }, (_, index) => index),
);
const watermarkStyle = computed<CSSProperties>(() => ({
  "--platform-watermark-color": props.color,
  "--platform-watermark-opacity": String(clamp(props.opacity, 0, 0.3, 0.08)),
  "--platform-watermark-font-size": `${clamp(props.fontSize, 10, 40, 16)}px`,
  "--platform-watermark-rotate": `${clamp(props.rotate, -90, 90, -24)}deg`,
  "--platform-watermark-columns": String(columns.value),
  "--platform-watermark-rows": String(rows.value),
  "--platform-watermark-z-index": String(
    Math.round(clamp(props.zIndex, 1, 2_147_483_000, 4000)),
  ),
}));
</script>

<template>
  <slot />
  <div
    v-if="props.enabled && text"
    :style="watermarkStyle"
    aria-hidden="true"
    class="platform-watermark"
    data-testid="platform-watermark"
  >
    <span v-for="cell in cells" :key="cell" class="platform-watermark__text">{{ text }}</span>
  </div>
</template>

<style scoped>
.platform-watermark {
  position: fixed;
  inset: 0;
  z-index: var(--platform-watermark-z-index);
  display: grid;
  grid-template-columns: repeat(var(--platform-watermark-columns), minmax(0, 1fr));
  grid-template-rows: repeat(var(--platform-watermark-rows), minmax(0, 1fr));
  overflow: hidden;
  color: var(--platform-watermark-color);
  pointer-events: none;
  user-select: none;
  opacity: var(--platform-watermark-opacity);
}

.platform-watermark__text {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  font-size: var(--platform-watermark-font-size);
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  letter-spacing: 0.08em;
  transform: rotate(var(--platform-watermark-rotate));
}
</style>
