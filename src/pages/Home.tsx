import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { JsonGraphView, THEMES, getTheme, type JgvEdgeStyle } from "@/json-graph-view";
import { SAMPLE_A, SAMPLE_B, SAMPLE_C, SAMPLE_D } from "@/samples";
import "../App.css";

const SAMPLES = [
  { id: "a", name: "装备成果示例", text: SAMPLE_A },
  { id: "b", name: "软件项目示例", text: SAMPLE_B },
  { id: "c", name: "深层嵌套示例", text: SAMPLE_C },
  { id: "d", name: "大数据量示例", text: SAMPLE_D },
];

const EDGE_STYLES: Array<{ id: JgvEdgeStyle; name: string }> = [
  { id: "smoothstep", name: "平滑折线" },
  { id: "bezier", name: "贝塞尔曲线" },
  { id: "straight", name: "直线" },
  { id: "step", name: "直角折线" },
];

const MIN_W = 260;
const MAX_W = 640;

/** 主题下拉菜单：色点 + 名称，文字颜色跟随当前外壳，保证可读 */
function ThemeSelect({
  theme,
  onChange,
}: {
  theme: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = getTheme(theme);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="demo-select" ref={ref}>
      <button className="demo-select-btn" onClick={() => setOpen((v) => !v)}>
        <span className="demo-dot" style={{ background: current.vars["--jgv-accent"] }} />
        {current.name}
        <span className={`demo-caret ${open ? "up" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="demo-select-menu">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`demo-select-item ${t.id === theme ? "active" : ""}`}
              onClick={() => {
                onChange(t.id);
                setOpen(false);
              }}
            >
              <span
                className="demo-swatch"
                style={{
                  background: t.vars["--jgv-node-bg"].startsWith("rgba")
                    ? t.vars["--jgv-header-bg"]
                    : t.vars["--jgv-node-bg"],
                  borderColor: t.vars["--jgv-node-border"],
                }}
              >
                <i style={{ background: t.vars["--jgv-accent"] }} />
              </span>
              <span className="demo-select-name">{t.name}</span>
              {t.id === theme && <span className="demo-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [text, setText] = useState(SAMPLE_A);
  const [committed, setCommitted] = useState(SAMPLE_A);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState("tech-blue");
  const [edgeStyle, setEdgeStyle] = useState<JgvEdgeStyle>("smoothstep");
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [search, setSearch] = useState("");
  const [panelW, setPanelW] = useState(360);
  const [collapsed, setCollapsed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragState = useRef<{ startX: number; startW: number } | null>(null);

  const themeObj = getTheme(theme);

  /** 外壳整体跟随当前主题：亮暗与配色全部取自主题变量 */
  const shellVars = useMemo(() => {
    const v = themeObj.vars;
    return {
      "--sh-bg": v["--jgv-bg"],
      "--sh-header": v["--jgv-node-bg"],
      "--sh-panel": v["--jgv-panel-bg"],
      "--sh-border": v["--jgv-panel-border"],
      "--sh-text": v["--jgv-text"],
      "--sh-dim": v["--jgv-text-dim"],
      "--sh-accent": v["--jgv-accent"],
      "--sh-hover": v["--jgv-header-bg"],
      "--sh-input": themeObj.dark ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.72)",
      "--sh-shadow": v["--jgv-shadow"],
    } as CSSProperties;
  }, [themeObj]);

  const data = useMemo(() => {
    try {
      return { value: JSON.parse(committed), error: null };
    } catch (e) {
      return { value: null, error: (e as Error).message };
    }
  }, [committed]);

  /** 自动优化格式：输入停顿 800ms 后，若 JSON 合法则自动美化并渲染 */
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const pretty = JSON.stringify(JSON.parse(text), null, 2);
        setError(null);
        if (pretty !== text) setText(pretty);
        if (pretty !== committed) setCommitted(pretty);
      } catch (e) {
        setError((e as Error).message);
      }
    }, 800);
    return () => clearTimeout(t);
  }, [text, committed]);

  const applySample = (s: (typeof SAMPLES)[number]) => {
    setText(s.text);
    setCommitted(s.text);
    setError(null);
  };

  const importFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const t = String(reader.result ?? "");
      try {
        const pretty = JSON.stringify(JSON.parse(t), null, 2);
        setText(pretty);
        setCommitted(pretty);
        setError(null);
      } catch (e) {
        setText(t);
        setError((e as Error).message);
      }
    };
    reader.readAsText(f);
  };

  /** 拖拽调整编辑区宽度 */
  const onDragStart = (e: React.MouseEvent) => {
    dragState.current = { startX: e.clientX, startW: panelW };
    const move = (ev: MouseEvent) => {
      if (!dragState.current) return;
      const w = dragState.current.startW + (ev.clientX - dragState.current.startX);
      setPanelW(Math.min(MAX_W, Math.max(MIN_W, w)));
    };
    const up = () => {
      dragState.current = null;
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "col-resize";
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  return (
    <div className="demo-shell" style={shellVars}>
      <header className="demo-header">
        <div className="demo-brand">
          <span className="demo-logo">JGV</span>
          <div>
            <h1>json-graph-view</h1>
            <p>JSON → 关系图可视化组件 · 点击节点查看数据块</p>
          </div>
        </div>
        <div className="demo-toolbar">
          <input
            className="demo-search"
            placeholder="搜索字段 / 值 / 路径…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="demo-seg" title="连线样式">
            {EDGE_STYLES.map((s) => (
              <button
                key={s.id}
                className={`demo-seg-item ${edgeStyle === s.id ? "active" : ""}`}
                onClick={() => setEdgeStyle(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
          <div className="demo-seg" title="连线关系标注（父字段名 / 数组下标）">
            <button
              className={`demo-seg-item ${showEdgeLabels ? "active" : ""}`}
              onClick={() => setShowEdgeLabels((v) => !v)}
            >
              连线标注
            </button>
          </div>
          <ThemeSelect theme={theme} onChange={setTheme} />
        </div>
      </header>

      <main className="demo-main">
        {/* 收起状态：细条 + 展开按钮 */}
        {collapsed ? (
          <div className="demo-rail">
            <button className="demo-rail-btn" title="展开 JSON 编辑区" onClick={() => setCollapsed(false)}>
              »
            </button>
            <span className="demo-rail-text">JSON 输入</span>
          </div>
        ) : (
          <aside className="demo-editor" style={{ width: panelW }}>
            <div className="demo-editor-bar">
              <div className="demo-editor-title-row">
                <span className="demo-editor-title">JSON 输入</span>
                <button className="demo-btn" title="收起" onClick={() => setCollapsed(true)}>«</button>
              </div>
              <div className="demo-editor-actions">
                {SAMPLES.map((s) => (
                  <button key={s.id} className="demo-btn" onClick={() => applySample(s)}>
                    {s.name}
                  </button>
                ))}
                <button className="demo-btn" onClick={() => fileRef.current?.click()}>导入 .json</button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
                />
              </div>
            </div>
            <textarea
              className="demo-textarea"
              spellCheck={false}
              placeholder="粘贴 JSON，停顿后自动格式化并渲染…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {error && <div className="demo-error">JSON 暂无法解析：{error}</div>}
            {/* 拖拽手柄 */}
            <div className="demo-resizer" onMouseDown={onDragStart} title="拖拽调整宽度" />
          </aside>
        )}

        <section className="demo-graph">
          {data.error ? (
            <div className="demo-placeholder">JSON 解析失败，请修正左侧内容</div>
          ) : (
            <JsonGraphView
              data={data.value}
              theme={theme}
              edgeStyle={edgeStyle}
              showEdgeLabels={showEdgeLabels}
              search={search}
              maxNodes={600}
            />
          )}
        </section>
      </main>
    </div>
  );
}
