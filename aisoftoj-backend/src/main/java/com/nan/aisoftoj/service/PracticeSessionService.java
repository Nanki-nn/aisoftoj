package com.nan.aisoftoj.service;

import com.nan.aisoftoj.dto.*;

public interface PracticeSessionService {

    StartPracticeSessionRes startPracticeSession(Integer userId, StartPracticeSessionReq startPracticeSessionReq);

    GETPracticeSessionRes getPracticeSessionDetail(Integer userId, Integer sessionId);

    PaperSubmitResponse submitPracticeSession(Integer userId, Integer sessionId, PaperSubmitRequest request);

}
