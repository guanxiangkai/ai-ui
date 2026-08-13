<script setup lang="ts">
import { ElAlert, ElButton, ElInput } from "element-plus";
import { computed, reactive, ref, useId } from "vue";

import type { PlatformLoginCredentials, PlatformLoginProps } from "./component-types.js";

const props = withDefaults(defineProps<PlatformLoginProps>(), {
  loading: false,
  error: "",
  usernameLabel: "账号",
  passwordLabel: "密码",
  submitLabel: "登录",
});

const emit = defineEmits<{
  /** 用户提交已完成基本校验的登录信息。 */
  submit: [request: PlatformLoginCredentials];
}>();

const usernameId = useId();
const passwordId = useId();
const errorId = useId();
const form = reactive({ username: "", password: "" });
const validationError = ref("");
const visibleError = computed(() => validationError.value || props.error);

function submit(): void {
  const username = form.username.trim();
  if (username.length === 0 || form.password.length === 0) {
    validationError.value = "请输入账号和密码";
    return;
  }

  validationError.value = "";
  emit("submit", { username, password: form.password });
}
</script>

<template>
  <section class="platform-login" aria-labelledby="platform-login-title">
    <header class="platform-login__header">
      <slot name="brand" />
      <h1 id="platform-login-title" class="platform-login__title">
        <slot name="title">登录</slot>
      </h1>
      <p class="platform-login__description">
        <slot name="description" />
      </p>
    </header>

    <ElAlert
      v-if="visibleError"
      :id="errorId"
      class="platform-login__error"
      type="error"
      :title="visibleError"
      :closable="false"
      show-icon
    />

    <form
      class="platform-login__form"
      :aria-describedby="visibleError ? errorId : undefined"
      @submit.prevent="submit"
    >
      <label class="platform-login__field" :for="usernameId">
        <span>{{ usernameLabel }}</span>
        <ElInput
          :id="usernameId"
          v-model="form.username"
          name="username"
          autocomplete="username"
          :disabled="loading"
        />
      </label>

      <label class="platform-login__field" :for="passwordId">
        <span>{{ passwordLabel }}</span>
        <ElInput
          :id="passwordId"
          v-model="form.password"
          name="password"
          type="password"
          autocomplete="current-password"
          show-password
          :disabled="loading"
        />
      </label>

      <slot name="extra" />

      <ElButton
        class="platform-login__submit"
        type="primary"
        native-type="submit"
        :loading="loading"
      >
        {{ submitLabel }}
      </ElButton>
    </form>
  </section>
</template>

<style scoped>
.platform-login {
  box-sizing: border-box;
  width: min(100%, 420px);
  padding: var(--platform-space-8);
  color: var(--platform-color-text);
  background: var(--platform-color-surface);
  border: 1px solid var(--platform-color-border);
  border-radius: var(--platform-radius-md);
  box-shadow: var(--platform-shadow-card);
}

.platform-login__header {
  margin-bottom: var(--platform-space-6);
  text-align: center;
}

.platform-login__title {
  margin: var(--platform-space-2) 0 0;
  font-size: 24px;
  line-height: 1.3;
}

.platform-login__description:empty {
  display: none;
}

.platform-login__description {
  margin: var(--platform-space-2) 0 0;
  color: var(--platform-color-text-muted);
}

.platform-login__error {
  margin-bottom: var(--platform-space-4);
}

.platform-login__form {
  display: grid;
  gap: var(--platform-space-4);
}

.platform-login__field {
  display: grid;
  gap: var(--platform-space-2);
  font-weight: 600;
}

.platform-login__submit {
  width: 100%;
  margin-top: var(--platform-space-2);
}
</style>
