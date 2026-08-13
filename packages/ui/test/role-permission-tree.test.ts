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
});
