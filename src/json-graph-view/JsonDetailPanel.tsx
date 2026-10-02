import { useMemo, useState } from "react";
import type { GraphNodeData } from "./jsonToGraph";

/** 极简 JSON 语法高亮：对 stringify 结果做逐行正则切分 */
function highlightLine(line: string, key: number) {
  const parts: React.ReactNode[] = [];
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\b(null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) parts.push(<span key={`p${i++}`} className="jgv-code-punct">{line.slice(last, m.index)}</span>);
    if (m[1] !== undefined && m[2] !== undefined) {
      parts.push(<span key={`k${i++}`} className="jgv-code-key">{m[1]}</span>);
      parts.push(<span key={`c${i++}`} className="jgv-code-punct">{m[2]}</span>);
    } else if (m[1] !== undefined) {
      parts.push(<span key={`s${i++}`} className="jgv-code-string">{m[1]}</span>);
    } else if (m[3] !== undefined) {
      parts.push(<span key={`b${i++}`} className="jgv-code-bool">{m[3]}</span>);
    } else if (m[4] !== undefined) {
      parts.push(<span key={`n${i++}`} className="jgv-code-null">{m[4]}</span>);
    } else if (m[5] !== undefined) {
      parts.push(<span key={`num${i++}`} className="jgv-code-number">{m[5]}</span>);
    }
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push(<span key={`t${i++}`} className="jgv-code-punct">{line.slice(last)}</span>);
  return <div key={key}>{parts}</div>;
}

export default function JsonDetailPanel({
  data,
  onClose,
}: {
  data: GraphNodeData;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => JSON.stringify(data.raw, null, 2) ?? "undefined", [data.raw]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard 不可用时静默 */
    }
  };

  return (
    <aside className="jgv-detail">
      <div className="jgv-detail-head">
        <span className="jgv-detail-title">{data.title} · 数据块</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="jgv-btn" onClick={copy}>{copied ? "已复制" : "复制 JSON"}</button>
          <button className="jgv-btn" onClick={onClose}>关闭</button>
        </div>
      </div>
      <div className="jgv-detail-path">{data.path}</div>
      <div className="jgv-detail-body">
        <pre className="jgv-code">{text.split("\n").map((l, i) => highlightLine(l, i))}</pre>
      </div>
    </aside>
  );
}
