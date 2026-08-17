package com.nan.aisoftoj.ai;

import com.nan.aisoftoj.common.ForbiddenException;
import com.nan.aisoftoj.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiInternalAuthenticatorTest {

    @Mock
    private AuthService authService;

    private AiInternalAuthenticator authenticator;

    @BeforeEach
    void setUp() {
        AiInternalProperties properties = new AiInternalProperties();
        properties.setServiceKey("server-secret");
        authenticator = new AiInternalAuthenticator(properties, authService);
    }

    @Test
    void rejectsMissingOrIncorrectServiceKeyBeforeJwtValidation() {
        assertThrows(ForbiddenException.class,
                () -> authenticator.authenticate(null, "Bearer token"));
        assertThrows(ForbiddenException.class,
                () -> authenticator.authenticate("wrong", "Bearer token"));

        verifyNoInteractions(authService);
    }

    @Test
    void delegatesJwtValidationToExistingAuthService() {
        when(authService.getCurrentUserId("Bearer token")).thenReturn(17);

        Integer userId = authenticator.authenticate("server-secret", "Bearer token");

        assertEquals(17, userId);
        verify(authService).getCurrentUserId("Bearer token");
    }

    @Test
    void blankConfiguredKeyFailsStartupValidation() {
        AiInternalProperties properties = new AiInternalProperties();

        assertThrows(IllegalStateException.class, properties::afterPropertiesSet);
    }
}
