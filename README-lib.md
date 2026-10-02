# json-graph-view

将任意 JSON 数据可视化为「关系图」的 React 组件，类似 jsoncrack：对象/数组自动展开为分层节点图，点击任意节点即可在右侧面板查看对应的 JSON 数据块（语法高亮 + 路径 + 一键复制）。内置 6 套主题。

## 安装

```bash
npm install json-graph-view @xyflow/react react react-dom
```

## 使用

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

## Props

| 属性 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `data` | `unknown` | 必填 | 任意 JSON 值（对象 / 数组 / 原始值） |
| `theme` | `string` | `"tech-blue"` | 主题 id，见下表 |
| `edgeStyle` | `"smoothstep" \| "bezier" \| "straight" \| "step"` | `"smoothstep"` | 连线样式：平滑折线 / 贝塞尔曲线 / 直线 / 直角折线 |
| `search` | `string` | `""` | 搜索关键字，命中节点高亮、其余变暗 |
| `maxNodes` | `number` | `500` | 节点数量上限，超出自动截断并提示 |
| `maxRows` | `number` | `6` | 单个节点内最多内联展示的字段行数 |
| `showControls` | `boolean` | `true` | 是否显示缩放控件 |
| `showMinimap` | `boolean` | `true` | 是否显示缩略导航图 |
| `className` / `style` | - | - | 透传到根容器 |
| `onNodeSelect` | `(data: GraphNodeData \| null) => void` | - | 节点选中/取消回调 |

## 主题

| id | 名称 | 深/浅 |
| --- | --- | --- |
| `tech-blue` | 航空科技蓝（默认） | 深 |
| `aurora-dark` | 极夜深蓝 | 深 |
| `emerald-ink` | 墨竹青 | 深 |
| `violet-dusk` | 暮紫霓虹 | 深 |
| `daylight` | 晨光白 | 浅 |
| `sandstone` | 暖阳米沙 | 浅 |

也可通过 `THEMES` 获取主题清单自行渲染切换器：

```ts
import { THEMES, getTheme } from "json-graph-view";
```

## 其他导出

```ts
import { jsonToGraph } from "json-graph-view";
// 直接使用解析器，拿到 { nodes, edges, hitLimit } 图结构，便于自定义渲染
```

## 从源码构建 / 打包

```bash
npm run build:lib   # 构建 ESM + CJS + 类型声明 + CSS 到 dist-lib/
npm run pack:lib    # 在 dist-lib/ 内生成 json-graph-view-x.y.z.tgz，可 npm publish 或本地安装
```
