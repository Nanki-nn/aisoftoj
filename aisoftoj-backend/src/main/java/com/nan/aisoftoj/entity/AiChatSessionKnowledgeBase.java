package com.nan.aisoftoj.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("ai_chat_session_knowledge_base")
public class AiChatSessionKnowledgeBase {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long sessionId;
    private Long knowledgeBaseId;
}
