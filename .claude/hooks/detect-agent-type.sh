#!/bin/bash

# 检测当前运行环境的 Agent 类型
# 输出：claude-code | cursor | unknown
# 退出码：始终返回 0

detect_agent_type() {
    # 检查 Claude Code
    if [ -n "$CLAUDE_CODE_SESSION" ] || [ -d ".claude" ]; then
        echo "claude-code"
        return 0
    fi
    
    # 检查 Cursor
    if [ -d ".cursor" ] || [ -f "$HOME/.cursor/hooks.json" ]; then
        echo "cursor"
        return 0
    fi
    
    # 未知环境
    echo "unknown"
    return 0
}

detect_agent_type