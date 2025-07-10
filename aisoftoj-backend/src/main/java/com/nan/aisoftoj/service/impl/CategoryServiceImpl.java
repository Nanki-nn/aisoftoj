package com.nan.aisoftoj.service.impl;

import com.nan.aisoftoj.entity.Category;
import com.nan.aisoftoj.mapper.CategoryMapper;
import com.nan.aisoftoj.service.CategoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class CategoryServiceImpl implements CategoryService {
    @Autowired
    private CategoryMapper categoryMapper;

    @Override
    public List<Category> getAllCategories() {
        return categoryMapper.selectList(null);
    }
} 