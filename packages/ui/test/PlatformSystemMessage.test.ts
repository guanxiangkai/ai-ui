import { flushPromises, mount } from "@vue/test-utils";
import { ElDrawer } from "element-plus";
import type { SystemClient, SystemMessage } from "@guanxiangkai/platform-client";
import { describe, expect, it, vi } from "vitest";

import PlatformSystemMessage from "../src/system/PlatformSystemMessage.vue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function message(id: string): SystemMessage {
  return {
    id,
    msgTitle: "待处理消息",
    msgType: "2",
    isRead: false,
  };
}

describe("PlatformSystemMessage", () => {
  it("关闭详情后不会由迟到的已读请求回填列表统计", async () => {
    const detail = deferred<SystemMessage>();
    const markRead = deferred<void>();
    const client = {
      listMessages: vi.fn().mockResolvedValue({ records: [message("message-1")], total: 1 }),
      getUnreadMessageCount: vi.fn().mockResolvedValue(1),
      listNotices: vi.fn().mockResolvedValue([]),
      getMessage: vi.fn(() => detail.promise),
      markMessageRead: vi.fn(() => markRead.promise),
    } as unknown as SystemClient;
    const wrapper = mount(PlatformSystemMessage, {
      props: { client, permissions: ["system:message:read"] },
      global: { directives: { loading: () => undefined } },
    });
    await flushPromises();

    await wrapper.find("tbody tr").trigger("click");
    detail.resolve(message("message-1"));
    await flushPromises();
    expect(client.markMessageRead).toHaveBeenCalledWith("message-1");

    const drawer = wrapper.findComponent(ElDrawer);
    drawer.vm.$emit("update:modelValue", false);
    drawer.vm.$emit("closed");
    await flushPromises();
    markRead.resolve();
    await flushPromises();

    expect(client.listMessages).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain("未读数1");
  });
});
