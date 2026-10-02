import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// 库模式构建：产出 json-graph-view 的可发布产物（ESM + CJS + CSS）
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist-lib",
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/json-graph-view/index.ts"),
      name: "JsonGraphView",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "json-graph-view.js" : "json-graph-view.cjs"),
      cssFileName: "style",
    },
    rollupOptions: {
      // React / React Flow 由使用方提供，避免重复打包
      external: ["react", "react-dom", "react/jsx-runtime", "@xyflow/react", "@xyflow/react/dist/style.css"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "@xyflow/react": "ReactFlow",
        },
      },
    },
  },
});
