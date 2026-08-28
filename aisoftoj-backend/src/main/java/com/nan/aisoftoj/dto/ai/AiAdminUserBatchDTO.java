package com.nan.aisoftoj.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AiAdminUserBatchDTO {
    private List<AiAdminUserDTO> records;
    private List<Integer> missingUserIds;
}
