<template>
  <section class="system-management-page">
    <section class="platform-panel system-management-hero">
      <div>
        <p class="platform-eyebrow">Shared Weather View</p>
        <h1>天气信息</h1>
        <span>按统一行政区划编码查询天气快照；页面仅读，数据由内部同步任务写入。</span>
      </div>
      <div class="system-weather-current" v-if="today">
        <small>{{ today.cityName || today.cityCode }} · {{ today.weatherDate }}</small>
        <strong>{{ today.temperature ?? "—" }}℃</strong>
        <span
          >{{ today.weatherCondition || "暂无天气描述" }} · {{ today.windDirection || "—" }}
          {{ today.windPower || "" }}</span
        >
      </div>
    </section>

    <section class="platform-panel system-query-panel">
      <div class="system-query-fields">
        <select v-model="cityCode" class="system-native-select" aria-label="选择行政区">
          <option value="" disabled>选择行政区</option>
          <option
            v-for="option in regionOptions"
            :key="option.value"
            :value="option.value"
            :disabled="option.disabled"
          >
            {{ option.label }}
          </option>
        </select>
        <el-input-number v-model="days" :min="1" :max="15" aria-label="预报天数" />
      </div>
      <div class="system-query-actions">
        <el-button :icon="Refresh" @click="loadRegions">刷新区域</el-button
        ><el-button type="primary" :icon="Search" :disabled="!cityCode" @click="loadWeather"
          >查询天气</el-button
        >
      </div>
    </section>

    <section class="platform-panel system-table-panel">
      <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false" />
      <el-table v-loading="loading" :data="forecast" stripe>
        <el-table-column prop="weatherDate" label="日期" width="130" />
        <el-table-column prop="cityName" label="区域" min-width="150" />
        <el-table-column prop="weatherCondition" label="天气" min-width="150" />
        <el-table-column label="温度" width="150"
          ><template #default="{ row }"
            >{{ row.tempLow ?? "—" }}℃ ~ {{ row.tempHigh ?? "—" }}℃</template
          ></el-table-column
        >
        <el-table-column label="风向风力" min-width="160"
          ><template #default="{ row }"
            >{{ row.windDirection || "—" }} {{ row.windPower || "" }}</template
          ></el-table-column
        >
        <el-table-column prop="humidity" label="湿度" width="100" />
        <el-table-column label="空气质量" width="130"
          ><template #default="{ row }"
            >{{ row.aqiLevel || "—" }}{{ row.aqi == null ? "" : ` (${row.aqi})` }}</template
          ></el-table-column
        >
        <el-table-column prop="collectTime" label="采集时间" width="180" />
        <template #empty><el-empty description="请选择区域查询天气" /></template>
      </el-table>
    </section>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  ElAlert,
  ElButton,
  ElEmpty,
  ElInputNumber,
  ElMessage,
  ElTable,
  ElTableColumn,
} from "element-plus";
import { Refresh, Search } from "@element-plus/icons-vue";
import type { SystemRegion, SystemWeather } from "@guanxiangkai/platform-client";
import { systemErrorMessage } from "./system-context";
import type { SystemViewProps } from "./system-types";

const props = withDefaults(defineProps<SystemViewProps>(), {
  permissions: () => [],
  superAdmin: false,
});
const cityCode = ref("");
const days = ref(7);
const today = ref<SystemWeather>();
const forecast = ref<SystemWeather[]>([]);
interface RegionOption {
  label: string;
  value: string;
  disabled?: boolean;
}
const regionOptions = ref<RegionOption[]>([]);
const loading = ref(false);
const loadError = ref("");
onMounted(() => void loadRegions());
function toOptions(items: SystemRegion[], depth = 0): RegionOption[] {
  return items.flatMap((item) => [
    {
      label: `${"　".repeat(depth)}${item.regionName}`,
      value: item.regionCode,
      disabled: item.enabled === false,
    },
    ...toOptions(item.children ?? [], depth + 1),
  ]);
}
function firstEnabledCode(items: SystemRegion[]): string {
  for (const item of items) {
    if (item.enabled !== false && item.regionCode) return item.regionCode;
    const childCode = firstEnabledCode(item.children ?? []);
    if (childCode) return childCode;
  }
  return "";
}
async function loadRegions() {
  try {
    const regions = await props.client.getRegionTree();
    regionOptions.value = toOptions(regions);
    if (!cityCode.value) cityCode.value = firstEnabledCode(regions);
    if (cityCode.value) await loadWeather();
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "区域数据加载失败"));
  }
}
async function loadWeather() {
  if (!cityCode.value) return;
  loading.value = true;
  loadError.value = "";
  try {
    const [current, list] = await Promise.all([
      props.client.getTodayWeather(cityCode.value),
      props.client.getWeatherForecast(cityCode.value, days.value),
    ]);
    today.value = current;
    forecast.value = list ?? [];
  } catch (error) {
    today.value = undefined;
    forecast.value = [];
    loadError.value = systemErrorMessage(error, "天气数据加载失败");
  } finally {
    loading.value = false;
  }
}
</script>
