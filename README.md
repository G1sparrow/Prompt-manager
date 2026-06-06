# PromptManager - 文生图提示词管理工具

一个面向 AI 绘画创作者的提示词管理工具，支持提示词扩写、多语言翻译和文件夹分类管理。

## 功能

### 📝 提示词扩写
调用 OpenAI 兼容 API，输入基础提示词，AI 自动扩写为结构化的文生图 prompt。支持自定义扩写风格预设。

### 🌐 多语言翻译
集成百度翻译 API，支持 8 种语言的提示词互译：中文、英语、日语、韩语、法语、德语、俄语、西班牙语。

### 📁 文件夹管理
树形文件夹结构管理提示词，支持新建/删除文件夹，卡片视图展示（含封面图或图标），支持从文件夹直接新建提示词。

### 🎨 扩写风格预设
内置 5 种扩写风格（通用扩写、写实摄影风、二次元/动漫风、概念艺术风、极简/扁平风），支持自建预设，使用 `{user_input}` 占位符模板。

### ⚙️ 可配置设置
- LLM API：自定义 API 地址、Key、模型（支持 13 个预设模型 + 自定义输入）
- 百度翻译：APP ID + Secret Key

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Python Flask |
| 数据库 | SQLite |
| 前端 | 原生 HTML / CSS / JS（单页面应用） |
| 样式 | Oswald + IBM Plex Mono / 工业基建主题 |
| 翻译 | 百度翻译 API |
| 扩写 | OpenAI 兼容 API（任意供应商） |

## 快速开始

### 环境要求
- Python 3.8+
- pip

### 安装与运行

```bash
# 克隆仓库
git clone <repo-url>
cd promptmanager

# 安装依赖
pip install -r requirements.txt

# 启动服务
python app.py
```

服务默认运行在 `http://127.0.0.1:5000`

## 配置

首次使用需在"设置"页面配置 API 信息：

### LLM 大模型
- **API 地址**：你的 AI API 端点（如 `https://api.deepseek.com`）
- **API Key**：你的 API 密钥
- **模型名称**：从预设列表选择或手动输入

### 百度翻译
前往 [百度翻译开放平台](https://fanyi-api.baidu.com/) 申请 APP ID 和 Secret Key。

## 项目结构

```
promptmanager/
├── app.py                  # Flask 路由与请求处理
├── config.py               # JSON 配置管理
├── database.py             # SQLite 数据库模型
├── api_handler.py          # LLM 扩写 & 百度翻译 API 封装
├── config.json             # 运行时配置文件（自动生成）
├── prompts.db              # SQLite 数据库（自动生成）
├── static/
│   ├── css/style.css       # 工业基建主题样式
│   ├── js/script.js        # 前端交互逻辑
│   └── generated/          # 本地图片副本
├── templates/
│   └── index.html          # 单页面应用
├── requirements.txt
└── README.md
```
