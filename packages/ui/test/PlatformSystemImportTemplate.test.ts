import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { SystemClient, SystemImportTemplate, SystemPage } from "@guanxiangkai/platform-client";

import PlatformSystemImportTemplate from "../src/system/PlatformSystemImportTemplate.vue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function template(id: string, templateName: string): SystemImportTemplate {
  return {
    id,
    templateName,
    templateCode: id,
    templateModule: "system",
    fileType: "xlsx",
    customImportEnabled: true,
  };
}

function page(records: SystemImportTemplate[]): SystemPage<SystemImportTemplate> {
  return { records, total: records.length };
}

describe("PlatformSystemImportTemplate", () => {
  it("以查询发起时的参数加载列表，并忽略旧请求错误", async () => {
    const first = deferred<SystemPage<SystemImportTemplate>>();
    const second = deferred<SystemPage<SystemImportTemplate>>();
    const listImportTemplates = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const client = {
      listImportTemplates,
      listImportMappings: vi.fn().mockResolvedValue({ records: [], total: 0 }),
    } as Pick<SystemClient, "listImportTemplates" | "listImportMappings"> as SystemClient;
    const wrapper = mount(PlatformSystemImportTemplate, {
      props: { client },
      global: { directives: { loading: () => undefined } },
    });

    const nameInput = wrapper.find("input[placeholder='模板名称']");
    await nameInput.setValue("最新模板");
    const searchButton = wrapper.findAll("button").find((button) => button.text() === "查询");
    if (!searchButton) throw new Error("导入模板页未渲染查询按钮");
    await searchButton.trigger("click");
    second.resolve(page([template("latest", "最新模板")]));
    await flushPromises();
    first.reject(new Error("旧列表失败"));
    await flushPromises();

    expect(listImportTemplates).toHaveBeenLastCalledWith({
      pageNum: 1,
      pageSize: 20,
      templateName: "最新模板",
      templateModule: "",
    });
    expect(wrapper.text()).toContain("最新模板");
    expect(wrapper.text()).not.toContain("旧列表失败");
    wrapper.unmount();
  });

  it("打开新增模板会使已离开编辑上下文的详情响应失效", async () => {
    const detail = deferred<SystemImportTemplate>();
    const client = {
      listImportTemplates: vi.fn().mockResolvedValue(page([template("template-1", "列表模板")])),
      listImportMappings: vi.fn().mockResolvedValue({ records: [], total: 0 }),
      getImportTemplate: vi.fn().mockReturnValue(detail.promise),
    } as Pick<
      SystemClient,
      "listImportTemplates" | "listImportMappings" | "getImportTemplate"
    > as SystemClient;
    const wrapper = mount(PlatformSystemImportTemplate, {
      props: {
        client,
        permissions: ["system:importTemplate:add", "system:importTemplate:edit"],
      },
      attachTo: document.body,
      global: { directives: { loading: () => undefined } },
    });
    await flushPromises();

    const editButton = wrapper.findAll("button").find((button) => button.text() === "编辑");
    const createButton = wrapper.findAll("button").find((button) => button.text() === "新增模板");
    if (!editButton || !createButton) throw new Error("导入模板页未渲染编辑或新增操作");
    await editButton.trigger("click");
    await createButton.trigger("click");
    detail.resolve({ ...template("template-1", "过期模板详情"), targetSchema: "old_schema" });
    await flushPromises();

    const dialogInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>(".el-dialog input"),
    );
    expect(dialogInputs.some((input) => input.value === "过期模板详情")).toBe(false);
    expect(dialogInputs.some((input) => input.value === "old_schema")).toBe(false);
    wrapper.unmount();
  });
});
