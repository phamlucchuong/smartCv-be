package vn.chuongpl.user_service;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;
import vn.chuongpl.user_service.dtos.ApiResponse;
import vn.chuongpl.user_service.features.candidate.CandidateController;
import vn.chuongpl.user_service.features.candidate.CandidateService;
import vn.chuongpl.user_service.features.candidate.S3Service;
import vn.chuongpl.user_service.features.candidate.settings.PreferenceLanguage;
import vn.chuongpl.user_service.features.candidate.settings.PreferenceTheme;
import vn.chuongpl.user_service.features.candidate.settings.PreferencesSettings;
import vn.chuongpl.user_service.features.candidate.settings.PreferencesSettingsRequest;
import vn.chuongpl.user_service.integration.ai.SkillExtractPublisher;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CandidateSettingsControllerTest {

    @Test
    void updatePreferences_shouldUseAuthenticatedCandidateAndReturnSavedPreferences() {
        CandidateService candidateService = mock(CandidateService.class);
        CandidateController controller = new CandidateController(
                candidateService,
                mock(S3Service.class),
                mock(SkillExtractPublisher.class)
        );
        PreferencesSettingsRequest request = PreferencesSettingsRequest.builder()
                .language(PreferenceLanguage.EN)
                .build();
        PreferencesSettings saved = PreferencesSettings.builder()
                .language(PreferenceLanguage.EN)
                .theme(PreferenceTheme.LIGHT)
                .build();
        when(candidateService.updatePreferences("user-1", request)).thenReturn(saved);

        ApiResponse<PreferencesSettings> response = controller.updatePreferences(request, "user-1");

        assertEquals(saved, response.getData());
        verify(candidateService).updatePreferences("user-1", request);
    }

    @Test
    void updatePreferences_shouldRequireCandidateRole() throws NoSuchMethodException {
        Method method = CandidateController.class.getMethod(
                "updatePreferences",
                PreferencesSettingsRequest.class,
                String.class
        );

        PreAuthorize preAuthorize = method.getAnnotation(PreAuthorize.class);

        assertNotNull(preAuthorize);
        assertEquals("hasRole('CANDIDATE')", preAuthorize.value());
    }
}
