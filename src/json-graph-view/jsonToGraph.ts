// json-graph-view — 将任意 JSON 解析为「节点 + 边」的关系图结构

export type JsonNodeKind =
  | "root"
  | "object"
  | "array"
  | "string"
  | "number"
  | "boolean"
  | "null";

export interface JsonRow {
  key: string;          // 字段名 / 数组下标
  preview: string;      // 行内预览文本
  kind: JsonNodeKind;   // 该行值的类型
  childId?: string;     // 若为容器，指向子节点 id（子树被截断时缺失）
}

export interface GraphNodeData {
  [key: string]: unknown; // React Flow 要求节点 data 满足 Record<string, unknown>
  path: string;              // JSON 路径，如 $.users[0].name
  kind: JsonNodeKind;
  title: string;             // 节点标题
  rows: JsonRow[];           // 容器节点内联展示的行（全量，展示几行由 rowsLimit 决定）
  isLeaf: boolean;
  leafValue?: string;        // 叶子节点的值文本
  raw: unknown;              // 对应的数据块原始引用
  truncated: boolean;        // 行数超出 maxRows，被折叠
  cut: boolean;              // 子树因节点上限被截断，存在未展开的子节点
  childCount: number;
  /* ---- 以下字段由 JsonGraphView 在运行时注入，解析器不产出 ---- */
  rowsLimit?: number;        // 当前展示的行数上限（展开/收起时变化）
  onToggleRows?: () => void; // 展开 / 收起被折叠的行
  onExpandChildren?: () => void; // 补全被截断的子节点
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceRowKey?: string;
  label?: string;        // 关系标注：对象字段名 / 数组下标（如 name、[0]）
}

export interface GraphModel {
  nodes: Array<{ id: string; data: GraphNodeData }>;
  edges: GraphEdge[];
  totalNodes: number;        // 实际生成的节点数
  hitLimit: boolean;         // 是否存在被截断（cut）的节点
  nextId: number;            // id 计数器，增量展开时续用
}

export interface ParseOptions {
  maxNodes?: number;    // 节点数量上限（默认 500）
  maxRows?: number;     // 单节点最多内联展示的行数（默认 6）
}

const primitiveKind = (v: unknown): JsonNodeKind | null => {
  // undefined 与 null 一致按 null 处理（JS 对象可能直接含 undefined，健壮性兜底）
  if (v === null || v === undefined) return "null";
  const t = typeof v;
  if (t === "string") return "string";
  if (t === "number") return "number";
  if (t === "boolean") return "boolean";
  return null;
};

export const previewOf = (v: unknown): string => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "string")
    return v.length > 40 ? JSON.stringify(v.slice(0, 37)) + '…"' : JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
};

const containerLabel = (v: unknown): { label: string; kind: JsonNodeKind } =>
  Array.isArray(v)
    ? { label: `[${(v as unknown[]).length}]`, kind: "array" }
    : { label: `{${Object.keys(v as object).length}}`, kind: "object" };

/** 遍历上下文：预算与选项 */
interface Walker {
  model: GraphModel;
  maxRows: number;
  canAdd: () => boolean;  // 是否还有节点预算
  onLimit: () => void;    // 触达上限时记录
}

/**
 * 深度优先遍历 JSON，容器（对象/数组）展开为节点，
 * 原始值作为节点内行；行始终全量记录（超 maxRows 由展示层折叠），
 * 节点数触达上限时子树截断（cut），后续可通过 expandNode 增量补全。
 */
function walkValue(
  w: Walker,
  value: unknown,
  path: string,
  title: string,
  parentId: string | null,
  edgeLabel?: string,
  rowKey?: string
): string | null {
  if (!w.canAdd()) {
    w.onLimit();
    return null;
  }
  const { model } = w;
  const id = `n${model.nextId++}`;
  const pk = primitiveKind(value);

  if (pk) {
    model.nodes.push({
      id,
      data: { path, kind: pk, title, rows: [], isLeaf: true, leafValue: previewOf(value), raw: value, truncated: false, cut: false, childCount: 0 },
    });
    if (parentId)
      model.edges.push({ id: `e-${parentId}-${id}-${rowKey ?? "v"}`, source: parentId, target: id, sourceRowKey: rowKey, label: edgeLabel });
    return id;
  }

  const isArr = Array.isArray(value);
  const nodeData: GraphNodeData = {
    path,
    kind: path === "$" ? "root" : isArr ? "array" : "object",
    title,
    rows: [],
    isLeaf: false,
    raw: value,
    truncated: false,
    cut: false,
    childCount: 0,
  };
  model.nodes.push({ id, data: nodeData });
  if (parentId)
    model.edges.push({ id: `e-${parentId}-${id}-${rowKey ?? "v"}`, source: parentId, target: id, sourceRowKey: rowKey, label: edgeLabel });

  fillContainer(w, nodeData, id, value as object, isArr);
  return id;
}

/** 展开一个容器节点的全部子项：全量记录行，容器子项递归建节点（受预算约束） */
function fillContainer(w: Walker, nodeData: GraphNodeData, id: string, value: object, isArr: boolean): void {
  const entries: Array<[string, unknown]> = Array.isArray(value)
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);

  const rows: JsonRow[] = [];
  let cut = false;

  for (const [k, v] of entries) {
    const pkChild = primitiveKind(v);
    if (!pkChild) {
      const { label, kind } = containerLabel(v);
      const childPath = isArr ? `${nodeData.path}[${k}]` : `${nodeData.path}.${k}`;
      const edgeLabel = isArr ? `[${k}]` : k;
      const childId = walkValue(w, v, childPath, k, id, edgeLabel, k);
      if (childId) rows.push({ key: k, preview: label, kind, childId });
      else {
        // 预算耗尽：行保留（无子节点），后续可通过 expandNode 补全
        cut = true;
        rows.push({ key: k, preview: label, kind });
      }
    } else {
      rows.push({ key: k, preview: previewOf(v), kind: pkChild });
    }
  }

  nodeData.rows = rows;
  nodeData.childCount = entries.length;
  nodeData.cut = cut;
  nodeData.truncated = rows.length > w.maxRows;
}

export function jsonToGraph(input: unknown, opts: ParseOptions = {}): GraphModel {
  const maxNodes = opts.maxNodes ?? 500;
  const maxRows = opts.maxRows ?? 6;
  const model: GraphModel = { nodes: [], edges: [], totalNodes: 0, hitLimit: false, nextId: 0 };
  const w: Walker = {
    model,
    maxRows,
    canAdd: () => model.nodes.length < maxNodes,
    onLimit: () => { model.hitLimit = true; },
  };
  walkValue(w, input, "$", Array.isArray(input) ? "root []" : "root {}", null, undefined, undefined);
  model.totalNodes = model.nodes.length;
  return model;
}

export interface ExpandOptions {
  maxRows?: number;    // 行折叠阈值（默认 6），用于重算 truncated
  budget?: number;     // 本次允许新增的节点数（默认 500）
}

/**
 * 独立展开一个因节点上限被截断（cut）的节点：
 * 只补全缺失的子节点（已有子树原样保留），行数据同步挂接 childId。
 * 返回新的 GraphModel（不修改入参）。
 */
export function expandNode(model: GraphModel, id: string, opts: ExpandOptions = {}): GraphModel {
  const source = model.nodes.find((n) => n.id === id);
  if (!source || source.data.isLeaf || !source.data.cut) return model;

  const maxRows = opts.maxRows ?? 6;
  const budget = opts.budget ?? 500;
  const value = source.data.raw as object;
  const isArr = Array.isArray(value);

  // 浅克隆模型与目标节点，保证入参不被修改、React 能感知变化
  const next: GraphModel = { ...model, nodes: model.nodes.slice(), edges: model.edges.slice() };
  const nodeData: GraphNodeData = { ...source.data, rows: source.data.rows.map((r) => ({ ...r })) };
  const idx = next.nodes.findIndex((n) => n.id === id);
  next.nodes[idx] = { id, data: nodeData };

  const entries = new Map<string, unknown>(
    Array.isArray(value)
      ? (value as unknown[]).map((v, i) => [String(i), v])
      : Object.entries(value as Record<string, unknown>)
  );

  let stillCut = false;
  const startCount = next.nodes.length;
  const w: Walker = {
    model: next,
    maxRows,
    canAdd: () => next.nodes.length - startCount < budget, // 每新建一个节点（含嵌套）都占用预算
    onLimit: () => { stillCut = true; },
  };

  for (const row of nodeData.rows) {
    if (row.childId) continue;                       // 已有子节点，跳过
    if (row.kind !== "object" && row.kind !== "array") continue; // 原始值行无需补全
    const v = entries.get(row.key);
    if (v === undefined || v === null || typeof v !== "object") continue;
    const childPath = isArr ? `${nodeData.path}[${row.key}]` : `${nodeData.path}.${row.key}`;
    const edgeLabel = isArr ? `[${row.key}]` : row.key;
    const childId = walkValue(w, v, childPath, row.key, id, edgeLabel, row.key);
    if (childId) row.childId = childId;
    else stillCut = true;
  }

  nodeData.cut = stillCut;
  nodeData.truncated = nodeData.rows.length > maxRows;
  next.totalNodes = next.nodes.length;
  next.hitLimit = next.nodes.some((n) => n.data.cut);
  return next;
}
