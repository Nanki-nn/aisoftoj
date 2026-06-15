package com.nan.aisoftoj.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nan.aisoftoj.entity.AiChatMessage;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AiChatMessageMapper extends BaseMapper<AiChatMessage> {
}
