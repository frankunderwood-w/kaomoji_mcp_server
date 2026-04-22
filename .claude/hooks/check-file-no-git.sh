#!/bin/bash

# 非 Git 项目用户接受度检测脚本
# 在等待计时器结束后调用（由 check-user-acceptance-timer.sh 调用）
# 通过文件存在性和哈希值判断用户是否接受了 Agent 的变更

CHANGED_FILES_LIST="/tmp/kaomoji-changed-files"
RESULT_FILE="/tmp/kaomoji-acceptance-result"

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
        echo ""
    fi
}

# 检查变更文件列表是否存在
if [ ! -f "$CHANGED_FILES_LIST" ]; then
    echo '{"accepted": true}' > "$RESULT_FILE"
    exit 0
fi

# 读取所有变更文件
declare -a changed_files
while IFS= read -r line; do
    changed_files+=("$line")
done < "$CHANGED_FILES_LIST"

# 如果没有变更文件，视为已接受
if [ ${#changed_files[@]} -eq 0 ]; then
    echo '{"accepted": true}' > "$RESULT_FILE"
    rm -f "$CHANGED_FILES_LIST"
    exit 0
fi

# 统计结果
accepted_count=0
rejected_count=0

for file in "${changed_files[@]}"; do
    # 生成安全路径
    safe_path=$(echo "$file" | sed 's/\//-/g')
    hash_file="/tmp/kaomoji-file-hash-${safe_path}"
    
    # 检查文件是否存在
    if [ ! -f "$file" ]; then
        # 文件被删除（用户拒绝了变更）
        ((rejected_count++))
    elif [ -f "$hash_file" ]; then
        # 检查哈希是否匹配
        stored_hash=$(cat "$hash_file")
        current_hash=$(compute_hash "$file")
        
        if [ "$stored_hash" = "$current_hash" ]; then
            # 哈希匹配（用户未修改，视为接受）
            ((accepted_count++))
        else
            # 哈希不匹配（用户修改了文件，也视为接受——用户基于 Agent 工作继续）
            ((accepted_count++))
        fi
    else
        # 没有哈希记录，但文件存在，保守视为接受
        ((accepted_count++))
    fi
    
    # 清理哈希文件
    rm -f "$hash_file"
done

# 判断结果：存在拒绝则视为未接受
if [ $rejected_count -gt 0 ]; then
    echo '{"accepted": false}' > "$RESULT_FILE"
else
    echo '{"accepted": true}' > "$RESULT_FILE"
fi

# 清理变更列表
rm -f "$CHANGED_FILES_LIST"

exit 0