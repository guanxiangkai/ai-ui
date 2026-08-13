<template>
  <section class="system-management-page">
    <section class="platform-panel system-management-hero">
      <div>
        <p class="platform-eyebrow">Personal Preferences</p>
        <h1>系统设置</h1>
        <span
          >统一管理语言、主题、通知与安全偏好。产品专属配置使用命名空间扩展，不污染通用字段。</span
        >
      </div>
      <div class="system-stat-grid">
        <article>
          <small>主题</small><strong class="system-stat-text">{{ themeLabel }}</strong
          ><span>当前显示偏好</span>
        </article>
        <article>
          <small>通知渠道</small><strong>{{ enabledNotifications }}</strong
          ><span>已开启</span>
        </article>
        <article>
          <small>扩展命名空间</small><strong>{{ extensionCount }}</strong
          ><span>产品隔离</span>
        </article>
      </div>
    </section>

    <section class="platform-panel system-setting-panel" v-loading="loading">
      <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false" />
      <el-form :model="form" label-position="top" :disabled="!canEdit || saving">
        <div class="system-setting-grid">
          <fieldset>
            <legend>界面</legend>
            <el-form-item label="语言"
              ><select v-model="form.language" class="system-native-select">
                <option value="zh-CN">简体中文</option>
                <option value="en-US">English</option>
              </select></el-form-item
            ><el-form-item label="主题"
              ><select v-model="form.theme" class="system-native-select">
                <option value="light">浅色</option>
                <option value="dark">深色</option>
                <option value="system">跟随系统</option>
              </select></el-form-item
            ><el-form-item label="字体大小"
              ><el-slider v-model="form.fontSize" :min="12" :max="24" show-input /></el-form-item
            ><el-form-item
              ><el-switch v-model="form.autoSave" active-text="自动保存"
            /></el-form-item>
          </fieldset>
          <fieldset>
            <legend>通知</legend>
            <el-form-item
              ><el-switch v-model="form.desktopNotification" active-text="桌面通知" /></el-form-item
            ><el-form-item
              ><el-switch v-model="form.soundNotification" active-text="声音提示" /></el-form-item
            ><el-form-item
              ><el-switch v-model="form.emailNotification" active-text="邮件通知" /></el-form-item
            ><el-form-item label="通知频率"
              ><select v-model="form.notificationFrequency" class="system-native-select">
                <option value="realtime">实时</option>
                <option value="daily">每日汇总</option>
                <option value="weekly">每周汇总</option>
              </select></el-form-item
            >
          </fieldset>
          <fieldset>
            <legend>安全</legend>
            <el-form-item
              ><el-switch v-model="form.loginProtection" active-text="登录保护" /></el-form-item
            ><el-form-item label="会话超时（分钟）"
              ><el-input-number v-model="form.sessionTimeout" :min="5" :max="1440"
            /></el-form-item>
            <p class="system-setting-hint">安全策略由平台统一存储，服务端仍是最终权限边界。</p>
          </fieldset>
        </div>
      </el-form>
      <footer class="system-setting-actions">
        <el-button :icon="Refresh" @click="load">恢复已保存设置</el-button
        ><el-button type="primary" :loading="saving" :disabled="!canEdit" @click="save"
          >保存设置</el-button
        >
      </footer>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  ElAlert,
  ElButton,
  ElForm,
  ElFormItem,
  ElInputNumber,
  ElMessage,
  ElSlider,
  ElSwitch,
} from "element-plus";
import { Refresh } from "@element-plus/icons-vue";
import type { SystemUserSetting } from "@guanxiangkai/platform-client";
import { hasSystemPermission, systemErrorMessage } from "./system-context";
import type { SystemViewProps } from "./system-types";

const props = withDefaults(defineProps<SystemViewProps>(), {
  permissions: () => [],
  superAdmin: false,
});
const emit = defineEmits<{ saved: [setting: SystemUserSetting] }>();
const canEdit = computed(() => hasSystemPermission(props, "system:setting:edit"));
const loading = ref(false);
const saving = ref(false);
const loadError = ref("");
const form = reactive<
  Required<Omit<SystemUserSetting, "extensions">> & { extensions: Record<string, unknown> }
>({
  language: "zh-CN",
  theme: "system",
  fontSize: 16,
  desktopNotification: true,
  soundNotification: true,
  emailNotification: false,
  notificationFrequency: "realtime",
  autoSave: true,
  loginProtection: true,
  sessionTimeout: 30,
  extensions: {},
});
const enabledNotifications = computed(
  () =>
    [form.desktopNotification, form.soundNotification, form.emailNotification].filter(Boolean)
      .length,
);
const extensionCount = computed(() => Object.keys(form.extensions).length);
const themeLabel = computed(
  () =>
    (({ light: "浅色", dark: "深色", system: "跟随" }) as Record<string, string>)[form.theme] ??
    form.theme,
);
onMounted(() => void load());
async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const setting = await props.client.getCurrentUserSetting();
    if (setting) Object.assign(form, setting, { extensions: setting.extensions ?? {} });
  } catch (error) {
    loadError.value = systemErrorMessage(error, "系统设置加载失败");
  } finally {
    loading.value = false;
  }
}
async function save() {
  saving.value = true;
  try {
    const setting = await props.client.updateCurrentUserSetting({ ...form });
    Object.assign(form, setting, { extensions: setting.extensions ?? {} });
    emit("saved", setting);
    ElMessage.success("系统设置已保存");
  } catch (error) {
    ElMessage.error(systemErrorMessage(error, "系统设置保存失败"));
  } finally {
    saving.value = false;
  }
}
</script>
