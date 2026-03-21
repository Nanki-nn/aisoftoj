package com.nan.aisoftoj.service;

import com.nan.aisoftoj.dto.PaperDTO;
import com.nan.aisoftoj.entity.Paper;

import java.util.List;

public interface PaperService {

    List<PaperDTO> getAllPapers();

    List<PaperDTO> getPapers(Integer subjectId, Integer cateId);

    Paper getById(Integer id);

}