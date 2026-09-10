import { describe, expect, it } from "vitest";

import { getRestorableLeafIds } from "../src/system/role-permission-tree.js";

const tree = [
  {
    id: "root",
    children: [
      {
        id: "role-page",
        children: [
          { id: "role-list" },
          { id: "role-query" },
          { id: "role-add" },
          { id: "role-edit" },
          { id: "role-delete" },
        ],
      },
    ],
  },
];

interface DeepPermissionNode {
  id: string;
  children?: DeepPermissionNode[];
}

describe("role permission tree", () => {
  it("restores only explicitly selected leaf nodes", () => {
    expect(getRestorableLeafIds(tree, ["root", "role-page", "role-list", "role-query"])).toEqual([
      "role-list",
      "role-query",
    ]);
  });

  it("does not expand parent-only or unknown selections", () => {
    expect(getRestorableLeafIds(tree, ["root", "role-page", "unknown"])).toEqual([]);
  });

  it("supports deep permission trees without recursive traversal", () => {
    const root: DeepPermissionNode = { id: "0" };
    let cursor = root;
    for (let index = 1; index <= 2_000; index += 1) {
      const child: DeepPermissionNode = { id: String(index) };
      cursor.children = [child];
      cursor = child;
    }

    expect(getRestorableLeafIds([root], ["2000"])).toEqual(["2000"]);
  });
});
