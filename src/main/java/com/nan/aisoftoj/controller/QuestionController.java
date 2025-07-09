package com.nan.aisoftoj.controller;

import com.nan.aisoftoj.entity.Question;
import com.nan.aisoftoj.entity.Category;
import com.nan.aisoftoj.service.QuestionService;
import com.nan.aisoftoj.service.CategoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/question")
public class QuestionController {
    @Autowired
    private QuestionService questionService;
    @Autowired
    private CategoryService categoryService;

    @GetMapping("/categories")
    public List<Category> getCategories() {
        return categoryService.getAllCategories();
    }

    @GetMapping("/search")
    public List<Question> search(
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) Long categoryId,
        @RequestParam(required = false) Integer type,
        @RequestParam(defaultValue = "1") Integer page,
        @RequestParam(defaultValue = "10") Integer size
    ) {
        return questionService.search(keyword, categoryId, type, page, size);
    }

    @GetMapping("/random")
    public Question getRandomQuestion(@RequestParam(required = false) Long categoryId) {
        return questionService.getRandomQuestion(categoryId);
    }

    @GetMapping("/sequence")
    public List<Question> getSequenceQuestions(
        @RequestParam(required = false) Long categoryId,
        @RequestParam(defaultValue = "1") Integer page,
        @RequestParam(defaultValue = "10") Integer size
    ) {
        return questionService.getSequenceQuestions(categoryId, page, size);
    }

    @GetMapping("/special")
    public List<Question> getSpecialQuestions(@RequestParam Long categoryId) {
        return questionService.getSpecialQuestions(categoryId);
    }
} 