#!/bin/bash

# 异步 Stop Hook：用户接受变更检测（带延迟计时器）
# 在 Agent 停止后延迟检查用户接受度，根据变更规模动态计算等待时间
# 由 settings.json 中 Stop hook 的 async: true 模式调用

CHANGED_FILES_LIST="/tmp/kaomoji-changed-files"
RESULT_FILE="/tmp/kaomoji-acceptance-result"

# 检查是否有变更文件
if [ ! -f "$CHANGED_FILES_LIST" ]; then
    # 没有变更，直接退出
    exit 0
fi

# 检查文件是否为空
if [ ! -s "$CHANGED_FILES_LIST" ]; then
    rm -f "$CHANGED_FILES_LIST"
    exit 0
fi

# 判断是否为 Git 项目
is_git_project() {
    git rev-parse --git-dir >/dev/null 2>&1
}

# 计算变更规模
calculate_change_scale() {
    local changed_lines=0
    
    if is_git_project; then
        # Git 项目：使用 git diff 统计
        local diff_stat
        diff_stat=$(git diff HEAD --stat 2>/dev/null | tail -1)
        if [ -n "$diff_stat" ]; then
            changed_lines=$(echo "$diff_stat" | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "0")
            changed_lines=${changed_lines:-0}
        fi
    else
        # 非 Git 项目：估算（文件数 * 50 行）
        local file_count
        file_count=$(wc -l < "$CHANGED_FILES_LIST" | tr -d ' ')
        changed_lines=$((file_count * 50))
    fi
    
    echo "$changed_lines"
}

# 计算等待时间（秒）
# 公式：min(max(60, changed_lines * 1.2), 600)
calculate_wait_time() {
    local changed_lines=$1
    local wait_seconds
    
    # 使用 awk 进行浮点运算
    wait_seconds=$(awk -v lines="$changed_lines" 'BEGIN {
        w = int(lines * 1.2);
        if (w < 60) w = 60;
        if (w > 600) w = 600;
        print w
    }')
    
    echo "$wait_seconds"
}

# 主逻辑
main() {
    # 计算变更规模
    local changed_lines
    changed_lines=$(calculate_change_scale)
    
    # 计算等待时间
    local wait_seconds
    wait_seconds=$(calculate_wait_time "$changed_lines")
    
    # 延迟等待，给用户足够时间审阅变更
    sleep "$wait_seconds"
    
    # 执行检测脚本
    if is_git_project; then
        bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/check-user-acceptance.sh
    else
        bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/check-file-no-git.sh
    fi
    
    # 读取结果并输出 systemMessage
    if [ -f "$RESULT_FILE" ]; then
        result=$(cat "$RESULT_FILE")
        # 解析 JSON 结果
        if echo "$result" | grep -q '"accepted": true'; then
            echo "{\"systemMessage\": \"用户似乎保留了本次变更（等待 ${wait_seconds}s 后 git/hash 检测结果：accepted）。可以继续下一步工作。\"}"
        elif echo "$result" | grep -q '"accepted": false'; then
            echo "{\"systemMessage\": \"用户可能撤销了本次变更（等待 ${wait_seconds}s 后 git/hash 检测结果：rejected）。如适合，可调用 apologize_kaomoji。\"}"
        else
            echo "{\"systemMessage\": \"无法确认用户是否接受变更（检测结果不确定）。建议手动检查文件状态。\"}"
        fi
        rm -f "$RESULT_FILE"
    else
        echo "{\"systemMessage\": \"无法确认用户是否接受变更（未找到检测结果）。建议手动检查文件状态。\"}"
    fi
}

main