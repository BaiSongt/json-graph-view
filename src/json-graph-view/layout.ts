import dagre from "@dagrejs/dagre";
import type { GraphEdge, GraphNodeData } from "./jsonToGraph";

export interface Positioned {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 依据内容估算节点尺寸（在渲染前完成，供 dagre 使用） */
export function estimateSize(data: GraphNodeData): { width: number; height: number } {
  if (data.isLeaf) {
    const valLen = Math.min((data.leafValue ?? "").length, 46);
    const width = Math.min(Math.max(150, valLen * 6.8 + 28, data.title.length * 7 + 28), 300);
    const lines = Math.max(1, Math.ceil(((data.leafValue ?? "").length * 6.8) / (width - 24)));
    return { width, height: 34 + lines * 18 };
  }
  let width = Math.max(180, data.title.length * 7.4 + 74);
  // 只计入当前实际展示的行（rowsLimit 由组件注入，未注入时视为全量）
  const visible = data.rowsLimit != null ? data.rows.slice(0, data.rowsLimit) : data.rows;
  for (const r of visible) {
    width = Math.max(width, r.key.length * 7.2 + r.preview.length * 6.6 + 36);
  }
  width = Math.min(width, 340);
  const rowCount = Math.max(visible.length, 1);
  // 底部操作行：行折叠开关（展开/收起各占一行高度）、子树截断展开按钮
  const moreRows = (data.truncated ? 1 : 0) + (data.cut ? 1 : 0);
  const height = 34 + rowCount * 22 + 8 + moreRows * 20 + (visible.length === 0 ? 6 : 0);
  return { width, height };
}

/** dagre 分层布局（左→右），返回各节点坐标 */
export function layoutGraph(
  nodes: Array<{ id: string; data: GraphNodeData }>,
  edges: GraphEdge[]
): Positioned[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 18, ranksep: 96, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));

  const sizes = new Map<string, { width: number; height: number }>();
  for (const n of nodes) {
    const s = estimateSize(n.data);
    sizes.set(n.id, s);
    g.setNode(n.id, { width: s.width, height: s.height });
  }
  for (const e of edges) g.setEdge(e.source, e.target);

  dagre.layout(g);

  return nodes.map((n) => {
    const p = g.node(n.id);
    const s = sizes.get(n.id)!;
    return { id: n.id, x: p.x - s.width / 2, y: p.y - s.height / 2, width: s.width, height: s.height };
  });
}
