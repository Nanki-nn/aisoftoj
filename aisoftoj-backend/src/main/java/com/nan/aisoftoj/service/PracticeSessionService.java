package com.nan.aisoftoj.service;

import com.nan.aisoftoj.dto.*;

public interface PracticeSessionService {

    StartPracticeSessionRes startPracticeSession(StartPracticeSessionReq startPracticeSessionReq);

    GETPracticeSessionRes getPracticeSessionDetail(Integer sessionId);

    PaperSubmitResponse submitPracticeSession(Integer sessionId,PaperSubmitRequest request);

}