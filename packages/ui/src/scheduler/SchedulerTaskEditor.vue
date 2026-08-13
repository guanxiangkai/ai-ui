<script setup lang="ts">
import type {
  SchedulerApplication,
  SchedulerTask,
  SchedulerTaskInput,
} from "@guanxiangkai/platform-client";
import {
  ElButton,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElSelect,
  ElSwitch,
} from "element-plus";
import { computed, reactive, watch } from "vue";

import SchedulerOption from "./SchedulerOption.vue";

type SchedulerTaskEditorForm = Required<Omit<SchedulerTaskInput, "jobParameters" | "remark">> & {
  jobParameters: string;
  remark: string;
};

interface Props {
  /** 是否显示编辑对话框。 */
  modelValue: boolean;
  /** 正在编辑的任务；为空表示创建任务。 */
  task: SchedulerTask | null;
  /** 当前租户允许选择的调度应用。 */
  applications: SchedulerApplication[];
  /** 保存请求是否正在执行。 */
  saving?: boolean;
}

const props = withDefaults(defineProps<Props>(), { saving: false });

const emit = defineEmits<{
  /** 更新对话框显示状态。 */
  "update:modelValue": [visible: boolean];
  /** 表单校验通过后提交当前任务输入。 */
  save: [input: SchedulerTaskInput];
}>();

const form = reactive<SchedulerTaskEditorForm>({
  taskCode: "",
  taskName: "",
  applicationCode: "",
  processorInfo: "",
  timeExpressionType: "CRON",
  timeExpression: "0 0 1 * * ?",
  jobParameters: "",
  maxInstanceNum: 1,
  concurrency: 1,
  instanceTimeLimit: 0,
  instanceRetryNum: 0,
  taskRetryNum: 0,
  enabled: true,
  remark: "",
});

const selectedApplication = computed(() =>
  props.applications.find((application) => application.code === form.applicationCode),
);

function resetForm(task: SchedulerTask | null): void {
  if (task !== null) {
    form.taskCode = task.taskCode;
    form.taskName = task.taskName;
    form.applicationCode = task.applicationCode;
    form.processorInfo = task.processorInfo;
    form.timeExpressionType = task.timeExpressionType;
    form.timeExpression = task.timeExpression;
    form.jobParameters = task.jobParameters ?? "";
    form.maxInstanceNum = task.maxInstanceNum;
    form.concurrency = task.concurrency;
    form.instanceTimeLimit = task.instanceTimeLimit;
    form.instanceRetryNum = task.instanceRetryNum;
    form.taskRetryNum = task.taskRetryNum;
    form.enabled = task.enabled;
    form.remark = task.remark ?? "";
    return;
  }
  const firstApplication = props.applications.find(
    (application) => application.handlers.length > 0,
  );
  form.taskCode = "";
  form.taskName = "";
  form.applicationCode = firstApplication?.code ?? "";
  form.processorInfo = firstApplication?.handlers[0]?.processorInfo ?? "";
  form.timeExpressionType = "CRON";
  form.timeExpression = "0 0 1 * * ?";
  form.jobParameters = "";
  form.maxInstanceNum = 1;
  form.concurrency = 1;
  form.instanceTimeLimit = 0;
  form.instanceRetryNum = 0;
  form.taskRetryNum = 0;
  form.enabled = true;
  form.remark = "";
}

watch(
  () => [props.modelValue, props.task] as const,
  ([visible, task]) => {
    if (visible) resetForm(task);
  },
  { immediate: true },
);

function applicationChanged(): void {
  form.processorInfo = selectedApplication.value?.handlers[0]?.processorInfo ?? "";
}

function validationError(): string | null {
  if (!/^[A-Za-z][A-Za-z0-9_.-]{2,127}$/u.test(form.taskCode.trim())) {
    return "任务编码需以字母开头，至少 3 位，且只能包含字母、数字、点、下划线和短横线";
  }
  if (form.taskName.trim().length === 0) return "请输入任务名称";
  if (form.applicationCode.length === 0) return "请选择所属应用";
  if (form.processorInfo.length === 0) return "请选择业务处理器";
  if (form.timeExpression.trim().length === 0) return "请输入时间表达式";
  if (form.timeExpressionType !== "CRON" && Number(form.timeExpression) < 1000) {
    return "固定频率或固定延迟不得小于 1000 毫秒";
  }
  return null;
}

function formInput(): SchedulerTaskInput {
  return {
    taskCode: form.taskCode.trim(),
    taskName: form.taskName.trim(),
    applicationCode: form.applicationCode,
    processorInfo: form.processorInfo,
    timeExpressionType: form.timeExpressionType,
    timeExpression: form.timeExpression.trim(),
    jobParameters: form.jobParameters.trim() || null,
    maxInstanceNum: form.maxInstanceNum,
    concurrency: form.concurrency,
    instanceTimeLimit: form.instanceTimeLimit,
    instanceRetryNum: form.instanceRetryNum,
    taskRetryNum: form.taskRetryNum,
    enabled: form.enabled,
    remark: form.remark.trim() || null,
  };
}

function submit(): void {
  const error = validationError();
  if (error !== null) {
    ElMessage.warning(error);
    return;
  }
  emit("save", formInput());
}
</script>

<template>
  <ElDialog
    :model-value="modelValue"
    :title="task === null ? '新建定时任务' : '编辑定时任务'"
    width="min(760px, 94vw)"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <ElForm label-position="top" class="platform-scheduler-form" @submit.prevent="submit">
      <ElFormItem label="任务名称" required>
        <ElInput v-model="form.taskName" maxlength="256" />
      </ElFormItem>
      <ElFormItem label="任务编码" required>
        <ElInput
          v-model="form.taskCode"
          maxlength="128"
          placeholder="例如 weekly.schedule.generate"
        />
      </ElFormItem>
      <ElFormItem label="所属应用" required>
        <ElSelect
          v-model="form.applicationCode"
          :disabled="task !== null"
          @change="applicationChanged"
        >
          <SchedulerOption
            v-for="application in applications"
            :key="application.code"
            :label="`${application.displayName}（${application.appName}）`"
            :value="application.code"
            :disabled="application.handlers.length === 0"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="业务处理器" required>
        <ElSelect v-model="form.processorInfo">
          <SchedulerOption
            v-for="handler in selectedApplication?.handlers ?? []"
            :key="handler.processorInfo"
            :label="handler.displayName"
            :value="handler.processorInfo"
          >
            <span>{{ handler.displayName }}</span>
            <small class="platform-scheduler-form__option">{{ handler.description }}</small>
          </SchedulerOption>
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="调度类型" required>
        <ElSelect v-model="form.timeExpressionType">
          <SchedulerOption label="Cron 表达式" value="CRON" />
          <SchedulerOption label="固定频率" value="FIXED_RATE" />
          <SchedulerOption label="固定延迟" value="FIXED_DELAY" />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="时间表达式" required>
        <ElInput
          v-model="form.timeExpression"
          :placeholder="form.timeExpressionType === 'CRON' ? '0 0 1 * * ?' : '毫秒数，最小 1000'"
        />
      </ElFormItem>
      <ElFormItem label="任务参数">
        <ElInput
          v-model="form.jobParameters"
          type="textarea"
          :rows="3"
          maxlength="8192"
          show-word-limit
        />
      </ElFormItem>
      <div class="platform-scheduler-form__numbers">
        <ElFormItem label="最大实例数">
          <ElInputNumber v-model="form.maxInstanceNum" :min="0" :max="1000" />
        </ElFormItem>
        <ElFormItem label="并发线程数">
          <ElInputNumber v-model="form.concurrency" :min="1" :max="1000" />
        </ElFormItem>
        <ElFormItem label="实例重试">
          <ElInputNumber v-model="form.instanceRetryNum" :min="0" :max="100" />
        </ElFormItem>
        <ElFormItem label="任务重试">
          <ElInputNumber v-model="form.taskRetryNum" :min="0" :max="100" />
        </ElFormItem>
      </div>
      <ElFormItem label="最长执行时间（毫秒，0 为不限制）">
        <ElInputNumber v-model="form.instanceTimeLimit" :min="0" :max="604800000" />
      </ElFormItem>
      <ElFormItem label="任务说明">
        <ElInput v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
      </ElFormItem>
      <ElFormItem label="创建后启用">
        <ElSwitch v-model="form.enabled" />
      </ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="emit('update:modelValue', false)">取消</ElButton>
      <ElButton type="primary" :loading="saving" @click="submit">保存并同步</ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.platform-scheduler-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 var(--platform-space-4);
}

.platform-scheduler-form :deep(.el-form-item:nth-child(n + 7)) {
  grid-column: 1 / -1;
}

.platform-scheduler-form :deep(.el-select),
.platform-scheduler-form :deep(.el-input-number) {
  width: 100%;
}

.platform-scheduler-form__numbers {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--platform-space-3);
}

.platform-scheduler-form__option {
  float: right;
  max-width: 320px;
  overflow: hidden;
  color: var(--platform-color-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .platform-scheduler-form,
  .platform-scheduler-form__numbers {
    grid-template-columns: 1fr;
  }
}
</style>
