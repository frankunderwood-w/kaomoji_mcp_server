#!/bin/bash

# PostToolUse Hook: 记录 Agent 写入的文件路径及内容 Hash
# 触发时机：Write|Edit|search_replace|create_file 工具调用后
# 输入：JSON 格式通过 stdin 传递
# 输出文件：
#   /tmp/kaomoji-changed-files  — 变更文件路径列表（追加）
#   /tmp/kaomoji-file-hash-{safe-path} — 各文件的哈希值

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# 兼容 macOS 和 Linux 的 hash 计算函数
compute_hash() {
    local file="$1"
    if command -v md5sum &> /dev/null; then
        md5sum "$file" 2>/dev/null | cut -d' ' -f1
    elif command -v md &> /dev/null; then
        md -q "$file" 2>/dev/null
    elif command -v shasum &> /dev/null; then
        shasum -a 256 "$file" 2>/dev/null | cut -d' ' -f1
    else
        echo "no-hash-tool"
    fi
}

if [ -n "$FILE_PATH" ]; then
    # 去重：避免重复记录同一文件
    if [ -f /tmp/kaomoji-changed-files ]; then
        if ! grep -qF "$FILE_PATH" /tmp/kaomoji-changed-files 2>/dev/null; then
            echo "$FILE_PATH" >> /tmp/kaomoji-changed-files
        fi
    else
        echo "$FILE_PATH" >> /tmp/kaomoji-changed-files
    fi

    if [ -f "$FILE_PATH" ]; then
        FILE_HASH=$(compute_hash "$FILE_PATH")
        SAFE_PATH="${FILE_PATH//\//-}"
        echo "$FILE_HASH" > "/tmp/kaomoji-file-hash-${SAFE_PATH}"
    fi
fi

exit 0