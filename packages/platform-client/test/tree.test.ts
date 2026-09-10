import { describe, expect, it } from "vitest";

import type {
  AgentPage,
  PlatformPage,
  PlatformTreeNode,
  SchedulerPage,
  SystemPage,
} from "../src/index.js";
import { filterTree, flattenTree, mapTree } from "../src/index.js";

type Assert<T extends true> = T;
type ExampleRecord = { code: string };
type _AgentPageUsesSharedFields = Assert<
  AgentPage<ExampleRecord> extends PlatformPage<ExampleRecord> ? true : false
>;
type _SchedulerPageUsesSharedFields = Assert<
  SchedulerPage<ExampleRecord> extends PlatformPage<ExampleRecord> ? true : false
>;
type _SystemPageRetainsPages = Assert<
  SystemPage<ExampleRecord>["pages"] extends number | undefined ? true : false
>;

interface TreeRecord extends PlatformTreeNode<TreeRecord> {
  id: string;
  businessCode: string;
}

describe("tree contracts", () => {
  it("保留分页差异和 DTO 业务字段的类型契约", () => {
    const systemPage: SystemPage<ExampleRecord> = {
      records: [{ code: "system" }],
      total: 1,
      pages: 1,
    };
    const agentPage: AgentPage<ExampleRecord> = { records: [{ code: "agent" }], total: 1 };

    expect(systemPage.pages).toBe(1);
    expect(agentPage.records[0]?.code).toBe("agent");

    const systemPageWithUndefined: SystemPage<ExampleRecord> = {
      records: [],
      total: 0,
      pageNum: undefined,
    };
    // @ts-expect-error Agent 分页原契约不接受显式 undefined。
    const agentPageWithUndefined: AgentPage<ExampleRecord> = {
      records: [],
      total: 0,
      pageNum: undefined,
    };
    expect(systemPageWithUndefined.pageNum).toBeUndefined();
    expect(agentPageWithUndefined).toBeDefined();
  });

  it("以稳定顺序展开、映射和筛选，筛选保留祖先且不修改输入", () => {
    const roots: TreeRecord[] = [
      {
        id: "root",
        businessCode: "R",
        children: [
          { id: "child-a", businessCode: "A" },
          { id: "child-b", businessCode: "B" },
        ],
      },
    ];

    expect(flattenTree(roots).map((node) => node.businessCode)).toEqual(["R", "A", "B"]);
    expect(
      mapTree(roots, (node, children, depth) => ({
        code: node.businessCode,
        depth,
        children,
      })),
    ).toEqual([
      {
        code: "R",
        depth: 0,
        children: [
          { code: "A", depth: 1, children: [] },
          { code: "B", depth: 1, children: [] },
        ],
      },
    ]);

    const filtered = filterTree(roots, (node) => node.businessCode === "B");
    expect(filtered).toEqual([
      {
        id: "root",
        businessCode: "R",
        children: [{ id: "child-b", businessCode: "B", children: [] }],
      },
    ]);
    expect(roots[0]?.children).toHaveLength(2);
    expect(roots[0]).not.toBe(filtered[0]);
  });

  it("接受空树，在深树中不使用调用栈，并明确拒绝循环", () => {
    const root: TreeRecord = { id: "0", businessCode: "0" };
    let cursor = root;
    for (let index = 1; index <= 5_000; index += 1) {
      const child: TreeRecord = { id: String(index), businessCode: String(index) };
      cursor.children = [child];
      cursor = child;
    }

    expect(flattenTree([])).toEqual([]);
    expect(flattenTree([root])).toHaveLength(5_001);
    let mappedCount = 0;
    expect(
      mapTree([root], (_node, _children, depth) => {
        mappedCount += 1;
        return depth;
      }),
    ).toEqual([0]);
    expect(mappedCount).toBe(5_001);
    expect(flattenTree(filterTree([root], (node) => node.id === "5000"))).toHaveLength(5_001);

    const cycle: TreeRecord = { id: "cycle", businessCode: "cycle" };
    cycle.children = [cycle];
    expect(() => flattenTree([cycle])).toThrow("树结构存在循环引用");
    expect(() => mapTree([cycle], (node) => node.id)).toThrow("树结构存在循环引用");
    expect(() => filterTree([cycle], () => true)).toThrow("树结构存在循环引用");
  });

  it("保留 undefined 映射结果，并按每条路径计算共享节点深度", () => {
    const shared: TreeRecord = { id: "shared", businessCode: "S" };
    const roots: TreeRecord[] = [
      { id: "first", businessCode: "F", children: [shared] },
      {
        id: "second",
        businessCode: "T",
        children: [{ id: "middle", businessCode: "M", children: [shared] }],
      },
    ];

    const leaf: TreeRecord = { id: "none", businessCode: "N" };
    expect(mapTree([leaf], () => undefined)).toEqual([undefined]);
    expect(
      mapTree(roots, (node, children, depth) => ({ id: `${node.id}@${depth}`, children })),
    ).toEqual([
      { id: "first@0", children: [{ id: "shared@1", children: [] }] },
      {
        id: "second@0",
        children: [{ id: "middle@1", children: [{ id: "shared@2", children: [] }] }],
      },
    ]);
  });
});
