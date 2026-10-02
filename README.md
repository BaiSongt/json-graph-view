# json-graph-view

将任意 JSON 数据可视化为「关系图」的 React 组件与在线演示应用，类似 [jsoncrack](https://jsoncrack.com/)：对象 / 数组自动展开为分层节点图，点击任意节点即可在右侧面板查看对应的 JSON 数据块（语法高亮 + 路径 + 一键复制）。

## ✨ 特性

- **自动布局** —— 基于 dagre 自动分层排列节点，复杂数据一目了然
- **节点联动** —— 点击图中的对象 / 数组节点，右侧面板即时展示对应的 JSON 数据块，含语法高亮、JSONPath 路径与一键复制
- **连线关系标注** —— 连线上显示父子关系（父字段名 / 数组下标，如 `name`、`[0]`），可一键开关
- **隐藏项独立展开** —— 超过行数上限的字段可在节点上单独「展开剩余 N 项 / 收起」；因节点数上限被截断的子树，可在对应节点单独「⊕ 展开被隐藏的子节点」，逐个补全而不影响其他部分
- **搜索高亮** —— 输入关键字，命中节点高亮、其余变暗
- **6 套主题** —— 4 深 2 浅，一键切换，整个界面（含演示外壳）跟随主题变化
- **4 种连线样式** —— 平滑折线 / 贝塞尔曲线 / 直线 / 直角折线
- **安全截断** —— 节点数超过上限自动截断并提示，超大 JSON 也不卡顿
- **同时是一个 npm 库** —— 可独立安装到任何 React 项目

## 🚀 在线演示（本仓库的 Demo）

```bash
npm install
npm run dev
```

打开浏览器访问 Vite 提示的地址，即可体验：

- 左侧编辑器粘贴 / 导入 JSON 文件，实时解析校验
- 切换 3 个内置示例（装备成果 / 软件项目 / 深层嵌套）
- 切换主题、连线样式，搜索节点
- 拖拽调整右侧数据面板宽度，可折叠

## 📦 作为组件库使用

```bash
npm install json-graph-view @xyflow/react react react-dom
```

```tsx
import { JsonGraphView } from "json-graph-view";
import "json-graph-view/style.css";

const data = {
  name: "示例",
  tags: ["a", "b"],
  meta: { version: 1, valid: true },
};

export default function App() {
  return (
    <div style={{ height: 600 }}>
      <JsonGraphView data={data} theme="tech-blue" search="" />
    </div>
  );
}
```

### Props

| 属性 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `data` | `unknown` | 必填 | 任意 JSON 值（对象 / 数组 / 原始值） |
| `theme` | `string` | `"tech-blue"` | 主题 id，见下表 |
| `edgeStyle` | `"smoothstep" \| "bezier" \| "straight" \| "step"` | `"smoothstep"` | 连线样式 |
| `showEdgeLabels` | `boolean` | `true` | 连线上是否显示关系标注（父字段名 / 数组下标） |
| `search` | `string` | `""` | 搜索关键字，命中节点高亮、其余变暗 |
| `maxNodes` | `number` | `500` | 节点数量上限，超出自动截断并提示 |
| `maxRows` | `number` | `6` | 单个节点内最多内联展示的字段行数 |
| `showControls` | `boolean` | `true` | 是否显示缩放控件 |
| `showMinimap` | `boolean` | `true` | 是否显示缩略导航图 |
| `className` / `style` | - | - | 透传到根容器 |
| `onNodeSelect` | `(data: GraphNodeData \| null) => void` | - | 节点选中 / 取消回调 |

### 主题

| id | 名称 | 深 / 浅 |
| --- | --- | --- |
| `tech-blue` | 航空科技蓝（默认） | 深 |
| `aurora-dark` | 极夜深蓝 | 深 |
| `emerald-ink` | 墨竹青 | 深 |
| `violet-dusk` | 暮紫霓虹 | 深 |
| `daylight` | 晨光白 | 浅 |
| `sandstone` | 暖阳米沙 | 浅 |

### 其他导出

```ts
import { THEMES, getTheme } from "json-graph-view";   // 主题清单，可自行渲染切换器
import { jsonToGraph } from "json-graph-view";        // 解析器，返回 { nodes, edges, hitLimit }
import { expandNode } from "json-graph-view";         // 增量展开被截断的节点（自定义渲染时可用）
```

## 🛠️ 从源码构建

```bash
npm run dev        # 启动演示应用
npm run build      # 构建演示应用
npm run lint       # ESLint 检查
npm run build:lib  # 构建 ESM + CJS + 类型声明 + CSS 到 dist-lib/
npm run pack:lib   # 在 dist-lib/ 内生成 json-graph-view-x.y.z.tgz，可 npm publish 或本地安装
```

## 📁 目录结构

```
src/
├── json-graph-view/   # 核心组件库（可直接打包发布）
│   ├── JsonGraphView.tsx   # 主组件
│   ├── JsonNode.tsx        # 图节点
│   ├── JsonDetailPanel.tsx # 右侧数据详情面板
│   ├── jsonToGraph.ts      # JSON → 图结构解析器
│   ├── layout.ts           # dagre 自动布局
│   └── themes.ts           # 6 套主题
├── pages/Home.tsx     # 演示应用主页
├── samples.ts         # 内置示例数据
└── components/ui/     # shadcn/ui 基础组件
```

## 🧰 技术栈

React 19 · TypeScript · Vite 7 · @xyflow/react（React Flow） · dagre · Tailwind CSS 3 · shadcn/ui

## 📄 许可证

[MIT](./LICENSE)
