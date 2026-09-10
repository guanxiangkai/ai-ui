import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { SystemClient, SystemMenu, SystemRegion } from "@guanxiangkai/platform-client";

import PlatformSystemMenu from "../src/system/PlatformSystemMenu.vue";
import PlatformSystemRegion from "../src/system/PlatformSystemRegion.vue";
import PlatformSystemWeather from "../src/system/PlatformSystemWeather.vue";

const regions: SystemRegion[] = [
  {
    id: "root",
    regionCode: "R",
    regionName: "根区域",
    regionLevel: "province",
    children: [
      {
        id: "child",
        regionCode: "C",
        regionName: "子区域",
        regionLevel: "city",
        enabled: false,
        children: [
          { id: "grandchild", regionCode: "G", regionName: "孙区域", regionLevel: "district" },
        ],
      },
      { id: "sibling", regionCode: "S", regionName: "旁支", regionLevel: "city" },
    ],
  },
];

const menus: SystemMenu[] = [
  {
    id: "root",
    menuName: "root",
    menuTitle: "根菜单",
    menuType: "DIRECTORY",
    children: [
      {
        id: "child",
        menuName: "child",
        menuTitle: "子菜单",
        menuType: "MENU",
        children: [
          { id: "grandchild", menuName: "grandchild", menuTitle: "孙菜单", menuType: "BUTTON" },
        ],
      },
      { id: "sibling", menuName: "sibling", menuTitle: "旁支菜单", menuType: "MENU" },
    ],
  },
];

describe("tree options", () => {
  it("编辑区域时保留祖先和旁支，排除当前节点及其子树", async () => {
    const client = {
      getRegionTree: vi.fn().mockResolvedValue(regions),
      getRegion: vi.fn().mockResolvedValue(regions[0]?.children?.[0]),
    } as Pick<SystemClient, "getRegionTree" | "getRegion"> as SystemClient;
    const wrapper = mount(PlatformSystemRegion, {
      props: { client, permissions: ["system:region:edit"] },
      attachTo: document.body,
      global: { directives: { loading: () => undefined } },
    });
    await flushPromises();
    const editButton = wrapper.findAll("button").filter((button) => button.text() === "编辑")[1];
    if (!editButton) throw new Error("区域页未渲染子区域编辑操作");
    await editButton.trigger("click");
    await flushPromises();

    const options = Array.from(document.querySelectorAll<HTMLSelectElement>(".el-dialog select"))[1]
      ?.options;
    expect(Array.from(options ?? []).map((option) => option.value)).toEqual([
      "0",
      "root",
      "sibling",
    ]);
    wrapper.unmount();
  });

  it("菜单和天气选项包含完整后代，天气保留禁用状态和区域编码", async () => {
    const menuClient = {
      getMenuTree: vi.fn().mockResolvedValue(menus),
      getMenu: vi.fn().mockResolvedValue(menus[0]?.children?.[0]),
    } as Pick<SystemClient, "getMenuTree" | "getMenu"> as SystemClient;
    const menuWrapper = mount(PlatformSystemMenu, {
      props: {
        client: menuClient,
        permissions: ["system:menu:query", "system:menu:edit"],
      },
      attachTo: document.body,
      global: { directives: { loading: () => undefined } },
    });
    await flushPromises();
    const editButton = menuWrapper
      .findAll("button")
      .filter((button) => button.text() === "编辑")[1];
    if (!editButton) throw new Error("菜单页未渲染子菜单编辑操作");
    await editButton.trigger("click");
    await flushPromises();
    await vi.waitFor(() => {
      expect(document.querySelector('select[aria-label="选择上级菜单"]')).not.toBeNull();
    });
    const menuOptions = document.querySelector<HTMLSelectElement>(
      'select[aria-label="选择上级菜单"]',
    )?.options;
    expect(Array.from(menuOptions ?? []).map((option) => option.value)).toEqual([
      "",
      "root",
      "sibling",
    ]);
    menuWrapper.unmount();

    const weatherClient = {
      getRegionTree: vi.fn().mockResolvedValue(regions),
      getTodayWeather: vi.fn().mockResolvedValue(undefined),
      getWeatherForecast: vi.fn().mockResolvedValue([]),
    } as Pick<
      SystemClient,
      "getRegionTree" | "getTodayWeather" | "getWeatherForecast"
    > as SystemClient;
    const weatherWrapper = mount(PlatformSystemWeather, {
      props: { client: weatherClient },
      global: { directives: { loading: () => undefined } },
    });
    await flushPromises();
    const options = weatherWrapper.find('select[aria-label="选择行政区"]').findAll("option");
    expect(options.map((option) => option.attributes("value"))).toEqual(["", "R", "C", "G", "S"]);
    expect(options[2]?.attributes("disabled")).toBeDefined();
    weatherWrapper.unmount();
  });
});
