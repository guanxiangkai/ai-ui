import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";

import PlatformWatermark from "../src/PlatformWatermark.vue";
import {
  createUserWatermarkText,
  getLeafDepartmentName,
  useUserWatermark,
} from "../src/watermark/user-watermark.js";

describe("用户页面水印", () => {
  it("提取末级部门并生成部门@姓名", () => {
    expect(getLeafDepartmentName("示例集团 / 技术中心 > 平台组")).toBe("平台组");
    expect(createUserWatermarkText("研发部", "示例用户")).toBe("研发部@示例用户");
    expect(createUserWatermarkText("", "示例用户")).toBe("");
  });

  it("渲染配置数量的水印且不影响页面插槽", () => {
    const wrapper = mount(PlatformWatermark, {
      props: {
        department: "示例集团 / 技术一组",
        name: "示例用户",
        columns: 2,
        rows: 3,
      },
      slots: { default: "应用页面" },
    });

    expect(wrapper.text()).toContain("应用页面");
    expect(wrapper.findAll(".platform-watermark__text")).toHaveLength(6);
    expect(wrapper.find(".platform-watermark__text").text()).toBe("技术一组@示例用户");
  });

  it("解析平台当前部门并在失败时显示明确的不可用提示", async () => {
    const user = ref({ id: "user-1", name: "示例用户" });
    const getCurrentDepartment = vi
      .fn()
      .mockResolvedValueOnce({ id: "dept-1", deptName: "示例集团 > 共享服务中心" })
      .mockRejectedValueOnce(new Error("部门服务不可用"));
    const watermark = useUserWatermark({
      user,
      client: { getCurrentDepartment },
    });

    await vi.waitFor(() => expect(watermark.text.value).toBe("共享服务中心@示例用户"));
    expect(watermark.visible.value).toBe(true);

    await watermark.refresh();
    await nextTick();
    expect(watermark.text.value).toBe("部门信息不可用@示例用户");
    expect(watermark.error.value).toBeInstanceOf(Error);
  });

  it("无效数值配置回退到安全默认值", () => {
    const wrapper = mount(PlatformWatermark, {
      props: {
        department: "技术中心",
        name: "示例用户",
        columns: Number.NaN,
        rows: Number.POSITIVE_INFINITY,
      },
    });

    expect(wrapper.findAll(".platform-watermark__text")).toHaveLength(24);
  });
});
