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
  childId?: string;     // 若为容器，指向子节点 id
}

export interface GraphNodeData {
  [key: string]: unknown; // React Flow 要求节点 data 满足 Record<string, unknown>
  path: string;              // JSON 路径，如 $.users[0].name
  kind: JsonNodeKind;
  title: string;             // 节点标题
  rows: JsonRow[];           // 容器节点内联展示的行
  isLeaf: boolean;
  leafValue?: string;        // 叶子节点的值文本
  raw: unknown;              // 对应的数据块原始引用
  truncated: boolean;        // 行数是否被截断
  childCount: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceRowKey?: string;
}

export interface GraphModel {
  nodes: Array<{ id: string; data: GraphNodeData }>;
  edges: GraphEdge[];
  totalNodes: number;        // 实际生成的节点数
  hitLimit: boolean;         // 是否触达节点上限
}

export interface ParseOptions {
  maxNodes?: number;    // 节点数量上限（默认 500）
  maxRows?: number;     // 单节点最多内联展示的行数（默认 6）
}

const primitiveKind = (v: unknown): JsonNodeKind | null => {
  if (v === null) return "null";
  const t = typeof v;
  if (t === "string") return "string";
  if (t === "number") return "number";
  if (t === "boolean") return "boolean";
  return null;
};

export const previewOf = (v: unknown): string => {
  if (v === null) return "null";
  if (typeof v === "string")
    return v.length > 40 ? JSON.stringify(v.slice(0, 37)) + '…"' : JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
};

/**
 * 深度优先遍历 JSON，容器（对象/数组）展开为节点，
 * 原始值作为节点内行或叶子节点；每个节点记录其 JSON 路径与原始数据块。
 */
export function jsonToGraph(input: unknown, opts: ParseOptions = {}): GraphModel {
  const maxNodes = opts.maxNodes ?? 500;
  const maxRows = opts.maxRows ?? 6;
  const nodes: GraphModel["nodes"] = [];
  const edges: GraphEdge[] = [];
  let hitLimit = false;
  let counter = 0;

  const makeId = () => `n${counter++}`;

  const addLeaf = (id: string, path: string, kind: JsonNodeKind, value: string, raw: unknown, title: string) => {
    nodes.push({
      id,
      data: { path, kind, title, rows: [], isLeaf: true, leafValue: value, raw, truncated: false, childCount: 0 },
    });
  };

  const walk = (value: unknown, path: string, title: string, parentId: string | null, rowKey?: string): string | null => {
    if (nodes.length >= maxNodes) {
      hitLimit = true;
      return null;
    }
    const id = makeId();
    const pk = primitiveKind(value);

    if (pk) {
      addLeaf(id, path, pk, previewOf(value), value, title);
      if (parentId) edges.push({ id: `e-${parentId}-${id}-${rowKey ?? "v"}`, source: parentId, target: id, sourceRowKey: rowKey });
      return id;
    }

    const isArr = Array.isArray(value);
    const entries: Array<[string, unknown]> = isArr
      ? (value as unknown[]).map((v, i) => [String(i), v])
      : Object.entries(value as Record<string, unknown>);

    const kind: JsonNodeKind = path === "$" ? "root" : isArr ? "array" : "object";
    const rows: JsonRow[] = [];
    let truncated = false;

    const nodeData: GraphNodeData = {
      path, kind, title, rows, isLeaf: false, raw: value, truncated: false, childCount: entries.length,
    };
    nodes.push({ id, data: nodeData });
    if (parentId) edges.push({ id: `e-${parentId}-${id}-${rowKey ?? "v"}`, source: parentId, target: id, sourceRowKey: rowKey });

    entries.forEach(([k, v], idx) => {
      const childPath = isArr ? `${path}[${k}]` : `${path}.${k}`;
      const pkChild = primitiveKind(v);
      if (!pkChild) {
        if (nodes.length >= maxNodes) { hitLimit = true; truncated = true; return; }
        const label = Array.isArray(v)
          ? `[${(v as unknown[]).length}]`
          : `{${Object.keys(v as object).length}}`;
        const childId = walk(v, childPath, k, id, k);
        if (childId) {
          if (idx < maxRows) rows.push({ key: k, preview: label, kind: Array.isArray(v) ? "array" : "object", childId });
          else truncated = true;
        } else truncated = true;
      } else {
        if (idx < maxRows) rows.push({ key: k, preview: previewOf(v), kind: pkChild });
        else truncated = true;
      }
    });

    nodeData.truncated = truncated;
    return id;
  };

  walk(input, "$", isRootArray(input) ? "root []" : "root {}", null, undefined);
  return { nodes, edges, totalNodes: nodes.length, hitLimit };
}

const isRootArray = (v: unknown) => Array.isArray(v);
