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
import { jsonToGraph, type GraphNodeData, type GraphModel } from "./jsonToGraph";
import { layoutGraph } from "./layout";
import { getTheme } from "./themes";

export type JgvEdgeStyle = "smoothstep" | "bezier" | "straight" | "step";

export interface JsonGraphViewProps {
  /** 任意 JSON 值（对象/数组/原始值均可） */
  data: unknown;
  /** 主题 id，见 THEMES；默认 "tech-blue" */
  theme?: string;
  /** 连线样式：smoothstep 平滑折线（默认）/ bezier 贝塞尔曲线 / straight 直线 / step 直角折线 */
  edgeStyle?: JgvEdgeStyle;
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

function buildFlow(model: GraphModel, edgeStyle: JgvEdgeStyle = "smoothstep"): { nodes: JsonFlowNode[]; edges: Edge[] } {
  const positions = layoutGraph(model);
  const posMap = new Map(positions.map((p) => [p.id, p]));
  const nodes: JsonFlowNode[] = model.nodes.map((n) => ({
    id: n.id,
    type: "jgv",
    position: { x: posMap.get(n.id)!.x, y: posMap.get(n.id)!.y },
    data: n.data,
  }));
  const rfType = edgeStyle === "bezier" ? "default" : edgeStyle;
  const edges: Edge[] = model.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: rfType,
    markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
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
  const model = useMemo(() => jsonToGraph(data, { maxNodes, maxRows }), [data, maxNodes, maxRows]);
  const flow = useMemo(() => buildFlow(model, edgeStyle), [model, edgeStyle]);

  const [nodes, setNodes, onNodesChange] = useNodesState<JsonFlowNode>(flow.nodes);
  const [selected, setSelected] = useState<string | null>(null);
  const { fitView } = useReactFlow();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNodes(flow.nodes);
    setSelected(null);
    const t = setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 50);
    return () => clearTimeout(t);
  }, [flow, setNodes, fitView]);

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
        edges={flow.edges.map((e) => ({
          ...e,
          style: focusSet && !(focusSet.has(e.source) && focusSet.has(e.target)) ? { opacity: 0.15 } : undefined,
        }))}
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
        <div className="jgv-notice">数据规模较大，已按上限截断为 {model.totalNodes} 个节点</div>
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
