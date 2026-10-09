# JSONL Viewer

[English](./README.md) | **简体中文**

一个基于 Next.js 的 JSONL 文件查看器，适合浏览日志、调试数据以及逐行存储的 JSON 数据。通过多标签页、虚拟滚动和三种查看模式，让结构化数据更易阅读。

## JSONL 是什么？

JSONL（JSON Lines）是一种每行存放一条独立 JSON 数据的文本格式，例如：

```jsonl
{"level":"info","message":"服务启动","port":3000}
{"level":"warn","message":"请求耗时较长","duration_ms":1200}
{"level":"error","message":"连接失败","details":{"retry":true}}
```

每一行都可以单独解析，适合记录日志、导出数据集或保存批量处理结果。

## 功能特点

- **拖拽打开**：将文件拖入页面，或点击 **Browse Files** 选择文件。
- **多文件标签页**：同时打开多个文件，随时切换或关闭；每个文件独立保留搜索条件和排列顺序。
- **文本搜索**：按原始 JSON 文本筛选记录，不区分大小写。
- **顺序切换**：按记录在文件中的顺序正序或倒序浏览，不是按字段值排序。
- **虚拟滚动**：通过 `react-window` 仅渲染列表可视区域内的记录，减少大量数据的渲染开销。
- **三种查看模式**：
  - **Pretty**：格式化显示 JSON，并对键名、字符串、数字、布尔值和 null 等进行语法高亮。
  - **Raw**：查看未经格式化的原始 JSON 行。
  - **Tree**：以树结构展开或折叠对象与数组，选择字段路径并查看对应值。
- **键盘操作**：使用 ↑ / ↓ 切换记录；在 Pretty 或 Raw 模式中，使用 Ctrl+A 或 Command+A 选择详情文本。
- **内容复制**：复制当前记录或树视图中选中的值。
- **可调整布局**：拖动分隔条调整面板宽度。
- **记录大小显示**：在 **Settings** 首页通过 **Show Record Sizes** 切换每条记录的字节大小显示，沿用原本的本地偏好。
- **主题设置**：通过 **Settings → Theme** 即时切换 **Dark / Light / Warm**，不重置日志阅读状态。
- **JSON 阅读设置**：通过 **Settings → JSON Reading** 调整右侧 JSON 的字号、行高和长文本换行，不缩放左侧列表或工具栏。
- **错误提示**：无法解析的记录会标记为无效 JSON，便于定位格式问题。
- **PWA 配置**：包含应用清单和 PWA 插件配置，可在支持的浏览器及部署环境中作为独立应用安装。

## 快速开始

### 环境准备

请先安装与项目依赖兼容的 Node.js 和 pnpm。项目使用的 pnpm 版本可在 `package.json` 的 `packageManager` 字段中查看。

### 本地开发

在项目根目录执行：

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

启动后，在浏览器中打开 [http://localhost:3000](http://localhost:3000)。

### 生产运行

```bash
# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start
```

## 使用方法

1. 将 JSONL 文件拖入页面，或点击 **Browse Files** 选择一个或多个文件。
2. 点击顶部文件标签，切换需要查看的文件。
3. 在左侧搜索框输入关键词，筛选包含相关文本的记录。
4. 点击左侧列表中的记录，在右侧查看详细内容。
5. 在 **Pretty**、**Raw** 和 **Tree** 之间切换查看方式。
6. 在 **Tree** 模式中展开节点，点击字段查看路径及对应值。
7. 使用 ↑ / ↓ 切换记录，或使用顺序切换按钮倒序浏览。
8. 按需复制内容、调整面板宽度，或切换记录大小显示。

### JSON 阅读设置

- **Font Size**：默认 13px，通过加减按钮在 10～24px 间调节，每次 1px。
- **Line Height**：Compact 1.3／Standard 1.6／Relaxed 1.9，默认 Standard。
- **Wrap Long Lines**：默认开启；关闭后超长内容在相应阅读区域横向滚动，原有换行及复制内容不变。
- **Reset Reading Settings**：只恢复上述三项，不改变主题、记录大小显示或日志状态。

设置即时作用于所有文件的 Pretty、Raw、Tree JSON 内容及无效 JSON 原文。
Tree 节点保留摘要，完整值遵守阅读设置；默认节点字号统一为 13px。
排版变化时尽量保留在原阅读内容附近，不承诺滚动像素完全不变。

## 文件处理与限制

- 文件通过浏览器的 `FileReader` 在本地读取和解析，当前查看流程不需要将文件内容上传到后端。
- 文件选择器支持 `.jsonl`、`.json`、`.log` 和 `.txt`，但内容仍按 JSONL 规则处理：每个非空行应是一条完整、独立的 JSON 数据。跨多行的普通 JSON 文档不适用。
- 空白行会被忽略；无效 JSON 行会保留并显示错误提示，不会导致整个文件解析中断。
- 当前实现会一次性读取并解析整个文件。虚拟滚动优化的是列表渲染，超大文件仍可能受到浏览器内存和解析耗时的限制。
- 已打开的文件保存在页面内存中，刷新页面后需要重新打开；主题、JSON 阅读设置和记录大小偏好在浏览器本地存储可用时会保留。
- 中文 README 仅提供中文使用说明，不改变应用界面的语言。

## 技术栈

- **Next.js 16**：使用 App Router，配置 Turbopack。
- **React 19**：构建交互界面。
- **TypeScript 7**：提供类型检查。
- **react-window 2**：实现虚拟列表。
- **@ducanh2912/next-pwa**：提供 PWA 支持。
- **lucide-react**：提供界面图标。
- **CSS Modules**：组织页面样式。
- **pnpm**：管理依赖及运行脚本。

## 项目结构

```text
jsonl-viewer/
├── public/                  # 应用清单和图标等静态资源
├── src/
│   └── app/
│       ├── page.tsx         # 文件解析、列表和三种查看模式
│       ├── page.module.css  # 页面样式
│       ├── layout.tsx       # 全局布局及应用元数据
│       └── globals.css      # 全局样式
├── next.config.js           # Next.js 和 PWA 配置
├── package.json             # 依赖及运行脚本
├── README.md                # 英文说明
└── README.zh-CN.md          # 中文说明
```

## 许可证

原项目 README 标注为 MIT。
