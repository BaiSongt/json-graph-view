import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useReactFlow,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./styles.css";
import JsonNode, { type JsonFlowNode } from "./JsonNode";
import JsonDetailPanel from "./JsonDetailPanel";
import { jsonToGraph, expandNode, type GraphNodeData, type GraphModel } from "./jsonToGraph";
import { layoutGraph } from "./layout";
import { getTheme } from "./themes";

export type JgvEdgeStyle = "smoothstep" | "bezier" | "straight" | "step";

/** 单次「展开被隐藏的子节点」允许新增的节点数 */
const EXPAND_BUDGET = 500;

export interface JsonGraphViewProps {
  /** 任意 JSON 值（对象/数组/原始值均可） */
  data: unknown;
  /** 主题 id，见 THEMES；默认 "tech-blue" */
  theme?: string;
  /** 连线样式：smoothstep 平滑折线（默认）/ bezier 贝塞尔曲线 / straight 直线 / step 直角折线 */
  edgeStyle?: JgvEdgeStyle;
  /** 连线上是否显示关系标注（父字段名 / 数组下标），默认 true */
  showEdgeLabels?: boolean;
  /** 图节点数量上限，超出截断，默认 500 */
  maxNodes?: number;
  /** 单个节点内最多内联行数，默认 6 */
  maxRows?: number;
  /** 搜索关键字：命中的节点高亮，其余降低透明度 */
  search?: string;
  showControls?: boolean;
  showMinimap?: boolean;
  className?: string;
  style?: CSSProperties;
  onNodeSelect?: (data: GraphNodeData | null) => void;
}

const nodeTypes = { jgv: JsonNode };

/** 构建流程图数据：注入 rowsLimit / 展开回调，并给边挂上关系标注 */
function buildFlow(
  model: GraphModel,
  ctx: {
    edgeStyle: JgvEdgeStyle;
    showEdgeLabels: boolean;
    maxRows: number;
    revealed: Set<string>;
    onToggleRows: (id: string) => void;
    onExpandChildren: (id: string) => void;
  }
): { nodes: JsonFlowNode[]; edges: Edge[] } {
  const nodes: JsonFlowNode[] = model.nodes.map((n) => {
    const limit = ctx.revealed.has(n.id)
      ? n.data.rows.length
      : Math.min(n.data.rows.length, ctx.maxRows);
    return {
      id: n.id,
      type: "jgv" as const,
      position: { x: 0, y: 0 },
      data: {
        ...n.data,
        rowsLimit: limit,
        ...(n.data.truncated ? { onToggleRows: () => ctx.onToggleRows(n.id) } : {}),
        ...(n.data.cut ? { onExpandChildren: () => ctx.onExpandChildren(n.id) } : {}),
      },
    };
  });
  const positions = layoutGraph(nodes, model.edges);
  const posMap = new Map(positions.map((p) => [p.id, p]));
  for (const n of nodes) {
    const p = posMap.get(n.id)!;
    n.position = { x: p.x, y: p.y };
  }
  const rfType = ctx.edgeStyle === "bezier" ? "default" : ctx.edgeStyle;
  const edges: Edge[] = model.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: rfType,
    markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
    ...(ctx.showEdgeLabels && e.label ? { label: e.label } : {}),
  }));
  return { nodes, edges };
}

/** 选中节点时，计算「祖先 + 后代 + 自身」集合用于聚焦高亮 */
function relatedSet(model: GraphModel, id: string): Set<string> {
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const e of model.edges) {
    (children.get(e.source) ?? children.set(e.source, []).get(e.source)!).push(e.target);
    (parents.get(e.target) ?? parents.set(e.target, []).get(e.target)!).push(e.source);
  }
  const set = new Set<string>([id]);
  const up = [id];
  while (up.length) {
    const c = up.pop()!;
    for (const p of parents.get(c) ?? []) if (!set.has(p)) { set.add(p); up.push(p); }
  }
  const down = [id];
  while (down.length) {
    const c = down.pop()!;
    for (const ch of children.get(c) ?? []) if (!set.has(ch)) { set.add(ch); down.push(ch); }
  }
  return set;
}

function GraphInner(props: JsonGraphViewProps) {
  const {
    data,
    theme = "tech-blue",
    edgeStyle = "smoothstep",
    showEdgeLabels = true,
    maxNodes = 500,
    maxRows = 6,
    search = "",
    showControls = true,
    showMinimap = true,
    className,
    style,
    onNodeSelect,
  } = props;

  const themeObj = getTheme(theme);
  const [model, setModel] = useState<GraphModel>(() => jsonToGraph(data, { maxNodes, maxRows }));
  /** 已展开全部行的节点 id 集合 */
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [lastParse, setLastParse] = useState({ data, maxNodes, maxRows });

  // 数据 / 参数变化时整体重置（渲染期守卫重置，避免额外 effect）
  if (lastParse.data !== data || lastParse.maxNodes !== maxNodes || lastParse.maxRows !== maxRows) {
    setLastParse({ data, maxNodes, maxRows });
    setModel(jsonToGraph(data, { maxNodes, maxRows }));
    setRevealed(new Set());
    setSelected(null);
  }

  const onToggleRows = useCallback((id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** 独立补全被截断的子树，同时顺带展开该节点的全部行 */
  const onExpandChildren = useCallback((id: string) => {
    setModel((m) => expandNode(m, id, { maxRows, budget: EXPAND_BUDGET }));
    setRevealed((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, [maxRows]);

  const flow = useMemo(
    () => buildFlow(model, { edgeStyle, showEdgeLabels, maxRows, revealed, onToggleRows, onExpandChildren }),
    [model, edgeStyle, showEdgeLabels, maxRows, revealed, onToggleRows, onExpandChildren]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<JsonFlowNode>(flow.nodes);
  const { fitView } = useReactFlow();
  const wrapRef = useRef<HTMLDivElement>(null);

  // 图数据变化时同步节点（渲染期守卫，避免额外 effect）；尽量保留仍存在的选中节点
  const [syncedFlow, setSyncedFlow] = useState(flow);
  if (syncedFlow !== flow) {
    setSyncedFlow(flow);
    setNodes(flow.nodes);
    setSelected((prev) => (prev && flow.nodes.some((n) => n.id === prev) ? prev : null));
  }

  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 50);
    return () => clearTimeout(t);
  }, [flow, fitView]);

  const matchedIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    const ids = new Set<string>();
    for (const n of model.nodes) {
      const d = n.data;
      if (
        d.title.toLowerCase().includes(q) ||
        d.path.toLowerCase().includes(q) ||
        (d.leafValue ?? "").toLowerCase().includes(q) ||
        d.rows.some((r) => r.key.toLowerCase().includes(q) || r.preview.toLowerCase().includes(q))
      )
        ids.add(n.id);
    }
    return ids;
  }, [model, search]);

  const focusSet = useMemo(() => (selected ? relatedSet(model, selected) : null), [model, selected]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      setSelected((prev) => {
        const next = prev === node.id ? null : node.id;
        onNodeSelect?.(next ? (model.nodes.find((n) => n.id === next)?.data ?? null) : null);
        return next;
      });
    },
    [model, onNodeSelect]
  );

  const onPaneClick = useCallback(() => {
    setSelected(null);
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  const selectedData = selected ? model.nodes.find((n) => n.id === selected)?.data ?? null : null;

  const themeVars = themeObj.vars as CSSProperties;

  return (
    <div ref={wrapRef} className={`jgv-root ${className ?? ""}`} style={{ ...themeVars, ...style }}>
      <div className="jgv-canvas-bg" />
      <div className="jgv-canvas-dots" />
      <ReactFlow
        nodes={nodes.map((n) => {
          const dimBySearch = matchedIds && !matchedIds.has(n.id);
          const dimByFocus = focusSet && !focusSet.has(n.id);
          const matched = matchedIds?.has(n.id);
          return {
            ...n,
            selected: n.id === selected,
            className: `${dimBySearch || dimByFocus ? "jgv-dim" : ""} ${matched ? "jgv-match" : ""}`,
          };
        })}
        edges={flow.edges.map((e) => {
          const dim = focusSet && !(focusSet.has(e.source) && focusSet.has(e.target));
          return {
            ...e,
            style: dim ? { opacity: 0.15 } : undefined,
            labelStyle: dim ? { opacity: 0.15 } : undefined,
          };
        })}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        minZoom={0.08}
        maxZoom={2.2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        fitView
      >
        {showControls && <Controls position="bottom-left" />}
        {showMinimap && (
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            nodeColor={() => themeObj.vars["--jgv-accent"]}
            maskColor={themeObj.dark ? "rgba(0,0,0,0.55)" : "rgba(220,225,235,0.6)"}
            style={{ width: 140, height: 90 }}
          />
        )}
      </ReactFlow>

      {model.hitLimit && (
        <div className="jgv-notice">
          数据规模较大，部分子项已隐藏（当前 {model.totalNodes} 个节点）—— 可在对应节点上点击「⊕ 展开被隐藏的子节点」逐个展开
        </div>
      )}

      {selectedData && <JsonDetailPanel data={selectedData} onClose={() => setSelected(null)} />}
    </div>
  );
}

export function JsonGraphView(props: JsonGraphViewProps) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}

export default JsonGraphView;
