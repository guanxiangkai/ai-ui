interface PermissionTreeNode {
  id: string;
  children?: PermissionTreeNode[];
}

/**
 * 计算角色权限树可以安全回显的叶节点 ID。
 *
 * 后端持久化的是“已选叶节点 + 半选祖先”的闭包。Element Plus 若直接收到祖先 ID，
 * 会级联选中其全部后代，因此回显必须只保留同时存在于当前树和已保存集合中的叶节点。
 * 未知 ID 与只有祖先而没有明确叶节点的异常数据按无权限处理。
 *
 * @param nodes 当前可配置的权限树
 * @param selectedIds 后端返回的已保存权限 ID
 * @returns 可安全传给 ElTree.setCheckedKeys 的叶节点 ID
 */
export function getRestorableLeafIds(nodes: PermissionTreeNode[], selectedIds: string[]): string[] {
  const selectedSet = new Set(selectedIds);
  return collectLeafIds(nodes).filter((id) => selectedSet.has(id));
}

function collectLeafIds(nodes: PermissionTreeNode[]): string[] {
  return nodes
    .flatMap((node) => {
      const children = node.children ?? [];
      return children.length ? collectLeafIds(children) : [node.id];
    })
    .filter(Boolean);
}
