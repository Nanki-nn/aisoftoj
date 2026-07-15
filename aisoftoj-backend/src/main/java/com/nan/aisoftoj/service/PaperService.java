package com.nan.aisoftoj.service;

import com.nan.aisoftoj.dto.PaperDTO;
import com.nan.aisoftoj.entity.Paper;

import java.util.List;

public interface PaperService {

    List<PaperDTO> getAllPapers(Integer userId);

    List<PaperDTO> getPapers(Integer userId, Integer subjectId, Integer cateId);

    Paper getPublishedPaper(Integer id);

    Paper getById(Integer id);

}
