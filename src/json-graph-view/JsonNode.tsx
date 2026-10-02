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
              {data.rows.map((r) => (
                <div key={r.key} className={`jgv-row ${r.childId ? "jgv-row-linked" : ""}`}>
                  <span className="jgv-row-key">{r.key}</span>
                  <span className={valClass(r.kind)}>{r.preview}</span>
                </div>
              ))}
              {data.truncated && <div className="jgv-row-more">… 还有 {Math.max(data.childCount - data.rows.length, 0)} 项，点击查看完整数据块</div>}
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
