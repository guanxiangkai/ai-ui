/** 可由普通 DTO 实现的树节点结构；不要求运行时继承。 */
export interface PlatformTreeNode<TNode> {
  /** 子节点。 */
  children?: TNode[];
}

interface TraversalFrame<TNode> {
  node: TNode;
  depth: number;
  leaving: boolean;
}

/**
 * 按先序展开树，保持输入节点和兄弟顺序，不修改输入。
 *
 * @throws {Error} 树存在循环引用时抛出明确错误。
 */
export function flattenTree<TNode extends PlatformTreeNode<TNode>>(
  roots: readonly TNode[],
): TNode[] {
  const nodes: TNode[] = [];
  walkTree(roots, (node) => {
    nodes.push(node);
  });
  return nodes;
}

/**
 * 按先序访问树节点。访问器返回 false 时跳过该节点的全部后代，输入不被修改。
 *
 * @throws {Error} 树存在循环引用时抛出明确错误。
 */
export function walkTree<TNode extends PlatformTreeNode<TNode>>(
  roots: readonly TNode[],
  visit: (node: TNode, depth: number) => boolean | void,
): void {
  const active = new Set<TNode>();
  const stack: TraversalFrame<TNode>[] = roots
    .map((node) => ({ node, depth: 0, leaving: false }))
    .reverse();

  while (stack.length) {
    const frame = stack.pop();
    if (!frame) continue;
    if (frame.leaving) {
      active.delete(frame.node);
      continue;
    }
    if (active.has(frame.node)) throw new Error("树结构存在循环引用");
    active.add(frame.node);
    const shouldVisitChildren = visit(frame.node, frame.depth) !== false;
    stack.push({ ...frame, leaving: true });
    if (!shouldVisitChildren) continue;
    const children = frame.node.children ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child) stack.push({ node: child, depth: frame.depth + 1, leaving: false });
    }
  }
}

/**
 * 以后序方式映射树。映射器收到已经映射的子节点和当前深度，输入不被修改。
 *
 * @throws {Error} 树存在循环引用时抛出明确错误。
 */
export function mapTree<TNode extends PlatformTreeNode<TNode>, TResult>(
  roots: readonly TNode[],
  mapNode: (node: TNode, children: TResult[], depth: number) => TResult,
): TResult[] {
  const active = new Set<TNode>();
  const results: TResult[] = [];
  interface MapFrame extends TraversalFrame<TNode> {
    mappedChildren: TResult[];
    parent?: MapFrame;
  }
  const stack: MapFrame[] = roots
    .map((node) => ({ node, depth: 0, leaving: false, mappedChildren: [] }))
    .reverse();

  while (stack.length) {
    const frame = stack.pop();
    if (!frame) continue;
    if (frame.leaving) {
      const mappedNode = mapNode(frame.node, frame.mappedChildren, frame.depth);
      active.delete(frame.node);
      if (frame.parent) frame.parent.mappedChildren.push(mappedNode);
      else results.push(mappedNode);
      continue;
    }
    if (active.has(frame.node)) throw new Error("树结构存在循环引用");

    active.add(frame.node);
    stack.push({ ...frame, leaving: true });
    const children = frame.node.children ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child) {
        stack.push({
          node: child,
          depth: frame.depth + 1,
          leaving: false,
          mappedChildren: [],
          parent: frame,
        });
      }
    }
  }

  return results;
}

/**
 * 筛选树并保留命中节点的祖先。返回节点为带筛选后 children 的新对象，输入不被修改。
 *
 * @throws {Error} 树存在循环引用时抛出明确错误。
 */
export function filterTree<TNode extends PlatformTreeNode<TNode>>(
  roots: readonly TNode[],
  predicate: (node: TNode) => boolean,
): TNode[] {
  return mapTree<TNode, TNode[]>(roots, (node, childResults) => {
    const children = childResults.flat();
    return predicate(node) || children.length ? [{ ...node, children }] : [];
  }).flat();
}
