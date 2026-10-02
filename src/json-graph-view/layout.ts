import dagre from "@dagrejs/dagre";
import type { GraphModel } from "./jsonToGraph";

export interface Positioned {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 依据内容估算节点尺寸（在渲染前完成，供 dagre 使用） */
export function estimateSize(data: GraphModel["nodes"][number]["data"]): { width: number; height: number } {
  if (data.isLeaf) {
    const valLen = Math.min((data.leafValue ?? "").length, 46);
    const width = Math.min(Math.max(150, valLen * 6.8 + 28, data.title.length * 7 + 28), 300);
    const lines = Math.max(1, Math.ceil(((data.leafValue ?? "").length * 6.8) / (width - 24)));
    return { width, height: 34 + lines * 18 };
  }
  let width = Math.max(180, data.title.length * 7.4 + 74);
  for (const r of data.rows) {
    width = Math.max(width, r.key.length * 7.2 + r.preview.length * 6.6 + 36);
  }
  width = Math.min(width, 340);
  const rowCount = Math.max(data.rows.length, 1);
  const height = 34 + rowCount * 22 + 8 + (data.truncated ? 20 : 0) + (data.rows.length === 0 ? 6 : 0);
  return { width, height };
}

/** dagre 分层布局（左→右），返回各节点坐标 */
export function layoutGraph(model: GraphModel): Positioned[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 18, ranksep: 96, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));

  const sizes = new Map<string, { width: number; height: number }>();
  for (const n of model.nodes) {
    const s = estimateSize(n.data);
    sizes.set(n.id, s);
    g.setNode(n.id, { width: s.width, height: s.height });
  }
  for (const e of model.edges) g.setEdge(e.source, e.target);

  dagre.layout(g);

  return model.nodes.map((n) => {
    const p = g.node(n.id);
    const s = sizes.get(n.id)!;
    return { id: n.id, x: p.x - s.width / 2, y: p.y - s.height / 2, width: s.width, height: s.height };
  });
}
