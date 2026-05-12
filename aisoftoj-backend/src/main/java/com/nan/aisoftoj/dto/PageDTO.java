package com.nan.aisoftoj.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PageDTO<T> {
    private List<T> records;
    private Long total;
    private Integer page;
    private Integer pageSize;
}
