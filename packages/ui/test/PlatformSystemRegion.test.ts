import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { SystemClient, SystemRegion } from "@guanxiangkai/platform-client";

import PlatformSystemRegion from "../src/system/PlatformSystemRegion.vue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function region(id: string, regionName: string): SystemRegion {
  return {
    id,
    regionName,
    regionCode: id,
    regionLevel: "province",
    parentId: "0",
    enabled: true,
  };
}

describe("PlatformSystemRegion", () => {
  it("忽略乱序列表的旧错误，只提交最新查询结果", async () => {
    const first = deferred<SystemRegion[]>();
    const second = deferred<SystemRegion[]>();
    const getRegionTree = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const client = { getRegionTree } as Pick<SystemClient, "getRegionTree"> as SystemClient;
    const wrapper = mount(PlatformSystemRegion, {
      props: { client },
      global: { directives: { loading: () => undefined } },
    });

    const searchButton = wrapper.findAll("button").find((button) => button.text() === "查询");
    if (!searchButton) throw new Error("区域页未渲染查询按钮");
    await searchButton.trigger("click");
    second.resolve([region("latest", "最新区域")]);
    await flushPromises();
    first.reject(new Error("旧查询失败"));
    await flushPromises();

    expect(wrapper.text()).toContain("最新区域");
    expect(wrapper.text()).not.toContain("旧查询失败");
    wrapper.unmount();
  });

  it("切换为新增区域后不回填已关闭编辑详情的旧响应", async () => {
    const detail = deferred<SystemRegion>();
    const client = {
      getRegionTree: vi.fn().mockResolvedValue([region("region-1", "列表区域")]),
      getRegion: vi.fn().mockReturnValue(detail.promise),
    } as Pick<SystemClient, "getRegionTree" | "getRegion"> as SystemClient;
    const wrapper = mount(PlatformSystemRegion, {
      props: {
        client,
        permissions: ["system:region:add", "system:region:edit"],
      },
      attachTo: document.body,
      global: { directives: { loading: () => undefined } },
    });
    await flushPromises();

    const editButton = wrapper.findAll("button").find((button) => button.text() === "编辑");
    const createButton = wrapper
      .findAll("button")
      .find((button) => button.text() === "新增顶级区域");
    if (!editButton || !createButton) throw new Error("区域页未渲染编辑或新增操作");
    await editButton.trigger("click");
    const dialogButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".el-dialog button"),
    );
    const cancelButton = dialogButtons.find((button) => button.textContent?.trim() === "取消");
    if (!cancelButton) throw new Error("区域编辑弹窗未渲染取消操作");
    cancelButton.click();
    await flushPromises();
    await createButton.trigger("click");
    detail.resolve({ ...region("region-1", "过期详情"), shortName: "旧简称" });
    await flushPromises();

    const dialogInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>(".el-dialog input"),
    );
    expect(dialogInputs.some((input) => input.value === "过期详情")).toBe(false);
    expect(dialogInputs.some((input) => input.value === "旧简称")).toBe(false);
    wrapper.unmount();
  });
});
