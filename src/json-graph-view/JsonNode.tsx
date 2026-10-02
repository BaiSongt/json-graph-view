import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { GraphNodeData, JsonNodeKind } from "./jsonToGraph";

export type JsonFlowNode = Node<GraphNodeData, "jgv">;

const valClass = (kind: JsonNodeKind) => `jgv-row-val jgv-val-${kind}`;

function JsonNode({ data, selected }: NodeProps<JsonFlowNode>) {
  const isContainer = !data.isLeaf;
  const dotColor =
    data.kind === "root"
      ? "var(--jgv-accent)"
      : data.kind === "array"
        ? "var(--jgv-k-array)"
        : "var(--jgv-k-object)";

  // 当前展示的行：rowsLimit 未注入时视为全量
  const limit = data.rowsLimit ?? data.rows.length;
  const visibleRows = data.rows.slice(0, limit);
  const hiddenCount = data.rows.length - visibleRows.length;
  const rowsShownAll = hiddenCount <= 0;
  // 因节点上限被截断、尚未生成子节点的容器行数
  const cutCount = data.rows.filter(
    (r) => !r.childId && (r.kind === "object" || r.kind === "array")
  ).length;

  return (
    <div className={`jgv-node ${selected ? "jgv-selected" : ""}`}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 6, height: 6 }} />
      {isContainer ? (
        <>
          <div className="jgv-node-header">
            <span className="jgv-kind-dot" style={{ background: dotColor }} />
            <span className="jgv-node-title">{data.title}</span>
            <span className="jgv-node-count">{data.childCount}</span>
          </div>
          {data.rows.length > 0 && (
            <div className="jgv-node-rows">
              {visibleRows.map((r) => (
                <div key={r.key} className={`jgv-row ${r.childId ? "jgv-row-linked" : ""}`}>
                  <span className="jgv-row-key">{r.key}</span>
                  <span className={valClass(r.kind)}>{r.preview}</span>
                </div>
              ))}
              {data.truncated && data.onToggleRows && (
                <button
                  className="jgv-row-toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    data.onToggleRows?.();
                  }}
                  title={rowsShownAll ? "收起多余行" : "展开本节点被折叠的行"}
                >
                  {rowsShownAll
                    ? "▲ 收起"
                    : `▼ 展开剩余 ${hiddenCount} 项`}
                </button>
              )}
              {data.cut && data.onExpandChildren && (
                <button
                  className="jgv-row-toggle jgv-row-toggle-cut"
                  onClick={(e) => {
                    e.stopPropagation();
                    data.onExpandChildren?.();
                  }}
                  title="该节点的部分子项因节点数上限被隐藏，点击单独展开"
                >
                  ⊕ 展开被隐藏的子节点{cutCount > 0 ? `（${cutCount} 项）` : ""}
                </button>
              )}
            </div>
          )}
          {data.rows.length === 0 && (
            <div className="jgv-row-more" style={{ padding: "8px 10px" }}>
              空{data.kind === "array" ? "数组" : "对象"}
            </div>
          )}
        </>
      ) : (
        <div className="jgv-leaf">
          <div className="jgv-leaf-label">{data.title}</div>
          <div className={valClass(data.kind)} style={{ textAlign: "left" }}>{data.leafValue}</div>
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 6, height: 6 }} />
    </div>
  );
}

export default memo(JsonNode);
