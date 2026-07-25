package com.nan.aisoftoj.crypto;

import com.nan.aisoftoj.controller.AdminController;
import com.nan.aisoftoj.controller.EssayController;
import com.nan.aisoftoj.controller.PaperController;
import com.nan.aisoftoj.controller.PracticeSessionController;
import com.nan.aisoftoj.controller.QuestionController;
import com.nan.aisoftoj.controller.UserStatsController;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;

class EncryptedEndpointCoverageTest {

    @Test
    void annotatedMethodSetMatchesQuestionContentContract() {
        Set<String> expected = new HashSet<>(Arrays.asList(
                "PaperController#getPaperQuestions",
                "QuestionController#getQuestionDetail",
                "PracticeSessionController#startPracticeSession",
                "PracticeSessionController#getPracticeSessionDetail",
                "EssayController#getHistory",
                "EssayController#getQuestions",
                "UserStatsController#getWrongQuestions",
                "AdminController#listQuestions",
                "AdminController#createQuestion",
                "AdminController#updateQuestion"
        ));

        Set<String> actual = Arrays.asList(
                        PaperController.class,
                        QuestionController.class,
                        PracticeSessionController.class,
                        EssayController.class,
                        UserStatsController.class,
                        AdminController.class)
                .stream()
                .flatMap(type -> Arrays.stream(type.getDeclaredMethods())
                        .filter(method -> method.isAnnotationPresent(EncryptedQuestionResponse.class))
                        .map(method -> type.getSimpleName() + "#" + method.getName()))
                .collect(Collectors.toSet());

        assertEquals(expected, actual);
    }
}
