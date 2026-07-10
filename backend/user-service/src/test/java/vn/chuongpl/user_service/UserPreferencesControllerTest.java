package vn.chuongpl.user_service;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;
import vn.chuongpl.user_service.dtos.ApiResponse;
import vn.chuongpl.user_service.features.user.UserController;
import vn.chuongpl.user_service.features.user.UserService;
import vn.chuongpl.user_service.features.user.settings.PreferenceLanguage;
import vn.chuongpl.user_service.features.user.settings.PreferenceTheme;
import vn.chuongpl.user_service.features.user.settings.PreferencesSettings;
import vn.chuongpl.user_service.features.user.settings.PreferencesSettingsRequest;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserPreferencesControllerTest {

    private final UserService userService = mock(UserService.class);
    private final UserController controller = new UserController(userService);

    @Test
    void updatePreferences_shouldUseAuthenticatedUserAndReturnSavedPreferences() {
        PreferencesSettingsRequest request = PreferencesSettingsRequest.builder()
                .language(PreferenceLanguage.EN)
                .build();
        PreferencesSettings saved = PreferencesSettings.builder()
                .language(PreferenceLanguage.EN)
                .theme(PreferenceTheme.LIGHT)
                .build();
        when(userService.updatePreferences("user-1", request)).thenReturn(saved);

        ApiResponse<PreferencesSettings> response = controller.updatePreferences(request, "user-1");

        assertEquals("Preferences updated", response.getMessage());
        assertEquals(saved, response.getData());
        verify(userService).updatePreferences("user-1", request);
    }

    @Test
    void updatePreferences_shouldRequireAuthenticatedUserRole() throws NoSuchMethodException {
        Method method = UserController.class.getMethod(
                "updatePreferences",
                PreferencesSettingsRequest.class,
                String.class
        );

        PreAuthorize annotation = method.getAnnotation(PreAuthorize.class);

        assertEquals("hasAnyRole('CANDIDATE', 'RECRUITER', 'ADMIN')", annotation.value());
    }
}
