import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import PlatformLogin from "../src/PlatformLogin.vue";

describe("PlatformLogin", () => {
  it("校验必填字段后发出登录信息", async () => {
    const wrapper = mount(PlatformLogin);

    await wrapper.get("form").trigger("submit");
    expect(wrapper.text()).toContain("请输入账号和密码");

    await wrapper.get('input[name="username"]').setValue(" tester ");
    await wrapper.get('input[name="password"]').setValue("secret");
    await wrapper.get("form").trigger("submit");

    expect(wrapper.emitted("submit")?.at(0)).toEqual([{ username: "tester", password: "secret" }]);
  });
});
