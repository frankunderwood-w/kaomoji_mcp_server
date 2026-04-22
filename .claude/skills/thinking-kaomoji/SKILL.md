# Thinking Kaomoji 技能

## 描述

在每个子任务或思考阶段开始时，调用 thinking_kaomoji 向用户展示当前工作进度。这会创建一个类似"深度思考"模式的可视化思考过程，让用户能实时了解 Agent 正在做什么。

## 触发场景

以下场景应使用此技能：

1. **进入新子任务** - 开始搜索、分析、重构等操作前
2. **阶段切换** - 从"规划"切换到"实现"、从"分析"切换到"验证"等
3. **启动后台代理** - 在启动 background agent 前
4. **新的推理路线** - 开始新的思考方向或分析路径
5. **调用其他 MCP Server 的工具** - 当准备调用其他 MCP 服务器的工具时，传入 mcp_server 参数标明目标服务器

## 执行流程

```
1. thinking_kaomoji({ phase: "搜索 API 接口定义" }) → 输出 kaomoji
2. [执行搜索]
3. thinking_kaomoji({ phase: "读取项目文件", mcp_server: "filesystem" }) → 输出 kaomoji
4. [调用 filesystem MCP Server 的工具]
5. thinking_kaomoji({ phase: "分析错误模式" }) → 输出 kaomoji
6. [分析结果]
7. thinking_kaomoji({ phase: "查询数据库", mcp_server: "postgres" }) → 输出 kaomoji
8. [调用 postgres MCP Server 的工具]
9. thinking_kaomoji({ phase: "实现修复" }) → 输出 kaomoji
10. [编写代码]
11. celebrate_kaomoji({ trigger: "task_complete" }) → 输出庆祝 kaomoji
```

## 输出格式

### 不带 MCP Server 名称

每次调用后，在回复中输出：
```
**[阶段名称]**
(kaomoji)
```

例如：
```
**搜索认证中间件**
(..)
```

### 带 MCP Server 名称

当调用其他 MCP Server 的工具时，在阶段名称后显示服务器名称：
```
**[阶段名称]** [MCP Server 名称]
(kaomoji)
```

例如：
```
**读取项目文件** [filesystem]
(..)
```

```
**查询用户数据** [postgres]
(._.)
```

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| phase | string (1-80 chars) | 是 | 当前子任务或思考阶段的简短描述 |
| mcp_server | string (1-64 chars) | 否 | 即将调用的 MCP Server 名称，如 "filesystem"、"github"、"postgres" |

## 注意事项

- 每个子任务或阶段只需调用一次
- phase 名称请控制在 80 字符以内
- mcp_server 名称请控制在 64 字符以内
- 简单单步操作无需调用（如读取已知文件）
- 最终给出答案时不使用此工具，改用 celebrate_kaomoji
- 不要在代码块、命令输出中插入 kaomoji
- 仅在准备调用其他 MCP Server 工具时才传入 mcp_server 参数