#!/bin/bash

# Stop Hook（同步）：任务完成时发送桌面通知
# 触发时机：Agent 停止响应时

send_notification() {
    local title="Kaomoji MCP"
    local message="Agent 任务已完成，请查看结果"
    
    # 检测操作系统
    case "$(uname -s)" in
        Darwin)
            # macOS
            if command -v osascript >/dev/null 2>&1; then
                osascript -e "display notification \"$message\" with title \"$title\"" 2>/dev/null || true
            fi
            ;;
        Linux)
            # Linux
            if command -v notify-send >/dev/null 2>&1; then
                notify-send "$title" "$message" 2>/dev/null || true
            fi
            ;;
        CYGWIN*|MINGW*|MSYS*)
            # Windows (Git Bash / MSYS)
            if command -v powershell.exe >/dev/null 2>&1; then
                powershell.exe -Command "
                    Add-Type -AssemblyName System.Windows.Forms;
                    [System.Windows.Forms.MessageBox]::Show('$message', '$title', 'OK', [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
                " 2>/dev/null || true
            fi
            ;;
        *)
            # 未知系统，静默退出
            ;;
    esac
}

# 主逻辑：仅发送通知，不执行其他检测
# 用户接受变更检测由 check-user-acceptance-timer.sh 异步处理
send_notification

exit 0