package vn.chuongpl.user_service.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.chuongpl.user_service.features.candidate.Candidate;
import vn.chuongpl.user_service.features.candidate.CandidateMapper;
import vn.chuongpl.user_service.features.candidate.CandidateRepository;
import vn.chuongpl.user_service.features.candidate.CandidateService;
import vn.chuongpl.user_service.features.candidate.settings.CandidateSettings;
import vn.chuongpl.user_service.features.candidate.settings.NotificationPreferences;
import vn.chuongpl.user_service.features.candidate.settings.PreferenceLanguage;
import vn.chuongpl.user_service.features.candidate.settings.PreferenceTheme;
import vn.chuongpl.user_service.features.candidate.settings.PreferencesSettings;
import vn.chuongpl.user_service.features.candidate.settings.PreferencesSettingsRequest;
import vn.chuongpl.user_service.features.candidate.settings.PrivacySettings;
import vn.chuongpl.user_service.features.candidate.settings.ProfileVisibility;
import vn.chuongpl.user_service.features.user.User;
import vn.chuongpl.user_service.features.user.UserRepository;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CandidateSettingsServiceTest {
    @Mock CandidateRepository candidateRepository;
    @Mock UserRepository userRepository;
    @Mock CandidateMapper candidateMapper;
    @Mock vn.chuongpl.user_service.features.servicepackage.ServicePackageRepository servicePackageRepository;
    @Mock vn.chuongpl.user_service.integration.notification.AiCreditExhaustedPublisher aiCreditExhaustedPublisher;
    @InjectMocks CandidateService candidateService;

    @Test
    void getSettings_shouldReturnDefaultSettingsForNewCandidate() {
        Candidate c = Candidate.builder().id("c1").userId("u1").build();
        when(candidateRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(c));

        CandidateSettings settings = candidateService.getSettings("u1");

        assertNotNull(settings);
        assertTrue(settings.getNotifications().isEmailApplicationUpdates());
        assertFalse(settings.getNotifications().isMarketingEmails());
        assertEquals(ProfileVisibility.RECRUITERS_ONLY, settings.getPrivacy().getProfileVisibility());
        assertEquals(PreferenceLanguage.VI, settings.getPreferences().getLanguage());
        assertEquals(PreferenceTheme.LIGHT, settings.getPreferences().getTheme());
    }

    @Test
    void updateNotificationPreferences_shouldPersistChanges() {
        Candidate c = Candidate.builder().id("c1").userId("u1").build();
        when(candidateRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(c));
        NotificationPreferences prefs = NotificationPreferences.builder()
                .emailApplicationUpdates(false).emailJobSuggestions(true)
                .pushNotifications(false).marketingEmails(true).build();

        candidateService.updateNotificationPreferences("u1", prefs);

        assertEquals(prefs, c.getSettings().getNotifications());
        verify(candidateRepository).save(c);
    }

    @Test
    void updatePrivacySettings_shouldPersistChanges() {
        Candidate c = Candidate.builder().id("c1").userId("u1").build();
        when(candidateRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(c));
        PrivacySettings privacy = PrivacySettings.builder()
                .profileVisibility(ProfileVisibility.PUBLIC)
                .showCvToRecruiters(false).showContactInfo(true).build();

        candidateService.updatePrivacySettings("u1", privacy);

        assertEquals(ProfileVisibility.PUBLIC, c.getSettings().getPrivacy().getProfileVisibility());
        verify(candidateRepository).save(c);
    }

    @Test
    void updatePreferences_shouldPersistSubmittedLanguageAndTheme() {
        Candidate c = Candidate.builder().id("c1").userId("u1").build();
        when(candidateRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(c));
        PreferencesSettingsRequest request = PreferencesSettingsRequest.builder()
                .language(PreferenceLanguage.EN)
                .theme(PreferenceTheme.DARK)
                .build();

        PreferencesSettings result = candidateService.updatePreferences("u1", request);

        assertEquals(PreferenceLanguage.EN, result.getLanguage());
        assertEquals(PreferenceTheme.DARK, result.getTheme());
        assertEquals(result, c.getSettings().getPreferences());
        verify(candidateRepository).save(c);
    }

    @Test
    void updatePreferences_shouldPreserveExistingValuesWhenFieldsAreNull() {
        CandidateSettings settings = CandidateSettings.builder()
                .preferences(PreferencesSettings.builder()
                        .language(PreferenceLanguage.EN)
                        .theme(PreferenceTheme.DARK)
                        .build())
                .build();
        Candidate c = Candidate.builder().id("c1").userId("u1").settings(settings).build();
        when(candidateRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(c));

        PreferencesSettings result = candidateService.updatePreferences("u1", PreferencesSettingsRequest.builder().build());

        assertEquals(PreferenceLanguage.EN, result.getLanguage());
        assertEquals(PreferenceTheme.DARK, result.getTheme());
        verify(candidateRepository).save(c);
    }

    @Test
    void deleteAccount_shouldSoftDeleteCandidateAndUser() {
        Candidate c = Candidate.builder().id("c1").userId("u1").build();
        User u = User.builder().id("u1").build();
        when(candidateRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(c));
        when(userRepository.findById("u1")).thenReturn(Optional.of(u));

        candidateService.deleteAccount("u1");

        assertTrue(c.isDeleted());
        assertNotNull(c.getDeletedAt());
        assertTrue(u.isDeleted());
        verify(candidateRepository).save(c);
        verify(userRepository).save(u);
    }
}
