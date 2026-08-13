import { computed, readonly, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from "vue";
import type { SystemClient } from "@guanxiangkai/platform-client";

/** 可用于生成页面水印的最小用户身份。 */
export interface UserWatermarkIdentity {
  /** 稳定用户标识，用于判断登录身份是否发生变化。 */
  id: string;
  /** 对用户可见的真实姓名或显示名称。 */
  name: string;
}

/** 用户水印解析器所需的平台部门客户端。 */
export type UserWatermarkClient = Pick<SystemClient, "getCurrentDepartment">;

/** 用户水印解析选项。 */
export interface UseUserWatermarkOptions {
  /** 当前登录用户；为空时不显示水印。 */
  user: MaybeRefOrGetter<UserWatermarkIdentity | null | undefined>;
  /** 已绑定当前网关和登录态的平台系统客户端。 */
  client: UserWatermarkClient;
  /** 已知部门名称；有值时不再请求平台当前部门接口。 */
  department?: MaybeRefOrGetter<string | null | undefined>;
  /** 页面是否允许显示水印。 */
  enabled?: MaybeRefOrGetter<boolean>;
  /** 当前用户没有部门时使用的明确提示。 */
  fallbackDepartment?: string;
  /** 部门接口不可用时使用的明确提示。 */
  unavailableDepartment?: string;
}

const DEPARTMENT_SEPARATOR = /\s*(?:\/|\\|>|＞|→|\|)\s*/u;
const DEFAULT_DEPARTMENT = "未分配部门";
const DEFAULT_UNAVAILABLE_DEPARTMENT = "部门信息不可用";

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 从部门路径或部门名称中提取最后一级部门。
 *
 * @param department 部门名称或使用斜线、反斜线、大于号、箭头分隔的部门路径
 * @returns 末级部门名称；输入为空时返回空字符串
 */
export function getLeafDepartmentName(department?: string | null): string {
  return (
    normalizeText(department)
      .split(DEPARTMENT_SEPARATOR)
      .map((item) => item.trim())
      .filter(Boolean)
      .at(-1) ?? ""
  );
}

/**
 * 按“末级部门@姓名”生成页面身份水印文本。
 *
 * @param department 部门名称或完整部门路径
 * @param name 当前用户姓名
 * @returns 完整水印文本；任一身份字段为空时返回空字符串
 */
export function createUserWatermarkText(department?: string | null, name?: string | null): string {
  const leafDepartment = getLeafDepartmentName(department);
  const normalizedName = normalizeText(name);
  return leafDepartment && normalizedName ? `${leafDepartment}@${normalizedName}` : "";
}

/**
 * 响应式解析当前用户的页面水印身份。
 *
 * 已知部门名称优先作为权威输入；否则通过平台当前部门接口加载。未配置部门与接口
 * 不可用使用不同提示，并通过 error 暴露失败原因，避免伪造部门信息。
 */
export function useUserWatermark(options: UseUserWatermarkOptions) {
  const department = ref("");
  const loading = ref(false);
  const error = shallowRef<unknown>(null);
  let requestVersion = 0;

  const user = computed(() => {
    const source = toValue(options.user);
    if (!source) return null;
    const id = normalizeText(source.id);
    const name = normalizeText(source.name);
    return id && name ? { id, name } : null;
  });
  const directDepartment = computed(() => getLeafDepartmentName(toValue(options.department)));
  const enabled = computed(
    () => options.enabled === undefined || Boolean(toValue(options.enabled)),
  );
  const fallbackDepartment =
    getLeafDepartmentName(options.fallbackDepartment) || DEFAULT_DEPARTMENT;
  const unavailableDepartment =
    getLeafDepartmentName(options.unavailableDepartment) || DEFAULT_UNAVAILABLE_DEPARTMENT;

  async function refresh(): Promise<void> {
    const version = ++requestVersion;
    error.value = null;

    if (!enabled.value || !user.value) {
      department.value = "";
      loading.value = false;
      return;
    }
    if (directDepartment.value) {
      department.value = directDepartment.value;
      loading.value = false;
      return;
    }

    loading.value = true;
    try {
      const currentDepartment = await options.client.getCurrentDepartment();
      if (version !== requestVersion) return;
      department.value = getLeafDepartmentName(currentDepartment?.deptName) || fallbackDepartment;
    } catch (reason) {
      if (version !== requestVersion) return;
      error.value = reason;
      department.value = unavailableDepartment;
    } finally {
      if (version === requestVersion) loading.value = false;
    }
  }

  watch(
    [() => user.value?.id, () => user.value?.name, directDepartment, enabled],
    () => void refresh(),
    { immediate: true },
  );

  const name = computed(() => user.value?.name ?? "");
  const text = computed(() => createUserWatermarkText(department.value, name.value));
  const visible = computed(() => enabled.value && Boolean(text.value));

  return {
    department: readonly(department),
    name,
    text,
    visible,
    loading: readonly(loading),
    error: readonly(error),
    refresh,
  };
}
