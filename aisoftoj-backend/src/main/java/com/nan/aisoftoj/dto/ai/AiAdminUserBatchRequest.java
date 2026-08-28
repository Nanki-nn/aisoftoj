package com.nan.aisoftoj.dto.ai;

import lombok.Data;

import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Positive;
import javax.validation.constraints.Size;
import java.util.List;

@Data
public class AiAdminUserBatchRequest {
    @NotEmpty
    @Size(max = 100)
    private List<@NotNull @Positive Integer> userIds;
}
