package vn.chuongpl.user_service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import vn.chuongpl.user_service.features.candidate.*;
import vn.chuongpl.user_service.dtos.response.CandidateResponse;
import vn.chuongpl.user_service.features.user.User;
import vn.chuongpl.user_service.features.user.UserRepository;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CvUrlRefreshTest {

    @Mock CandidateRepository candidateRepository;
    @Mock S3Service s3Service;
    @Mock UserRepository userRepository;
    @Mock CandidateMapper candidateMapper;
    @Mock vn.chuongpl.user_service.features.servicepackage.ServicePackageRepository servicePackageRepository;
    @Mock vn.chuongpl.user_service.integration.notification.AiCreditExhaustedPublisher aiCreditExhaustedPublisher;
    @InjectMocks CandidateService candidateService;

    private Candidate candidateWithKey;
    private Candidate candidateNoKey;

    @BeforeEach
    void setUp() {
        CvItem cvWithKey = CvItem.builder()
                .id("cv-1").s3Key("cvs/user1/uuid.pdf").url("http://expired-url")
                .filename("resume.pdf").isDefault(true).build();
        candidateWithKey = Candidate.builder()
                .userId("user1").cvs(new java.util.ArrayList<>(List.of(cvWithKey))).deleted(false).build();

        CvItem cvNoKey = CvItem.builder()
                .id("cv-2").url("http://legacy-url").filename("old.pdf").isDefault(true).build();
        candidateNoKey = Candidate.builder()
                .userId("user2").cvs(new java.util.ArrayList<>(List.of(cvNoKey))).deleted(false).build();

        given(servicePackageRepository.findById(anyString()))
                .willReturn(Optional.of(vn.chuongpl.user_service.features.servicepackage.ServicePackage.builder().aiCredits(10).build()));
    }

    @Test
    void listCvs_regeneratesUrl_whenS3KeyPresent() {
        given(candidateRepository.findByUserIdAndDeletedFalse("user1"))
                .willReturn(Optional.of(candidateWithKey));
        given(s3Service.generateFreshUrl("cvs/user1/uuid.pdf")).willReturn("http://fresh-url");

        List<CvItem> result = candidateService.listCvs("user1");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getUrl()).isEqualTo("http://fresh-url");
        verify(s3Service).generateFreshUrl("cvs/user1/uuid.pdf");
    }

    @Test
    void listCvs_usesStoredUrl_whenNoS3Key() {
        given(candidateRepository.findByUserIdAndDeletedFalse("user2"))
                .willReturn(Optional.of(candidateNoKey));

        List<CvItem> result = candidateService.listCvs("user2");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getUrl()).isEqualTo("http://legacy-url");
        verify(s3Service, never()).generateFreshUrl(any());
    }

    @Test
    void addCvToList_storesS3Key() {
        given(candidateRepository.findByUserIdAndDeletedFalse("user1"))
                .willReturn(Optional.of(candidateWithKey));
        given(candidateRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

        candidateService.addCvToList("user1", "cvs/user1/new.pdf", "http://new-url", "new.pdf");

        verify(candidateRepository).save(argThat(c ->
                c.getCvs().stream().anyMatch(cv -> "cvs/user1/new.pdf".equals(cv.getS3Key()))
        ));
    }

    @Test
    void refreshCvUrl_returnsGeneratedUrl_whenKeyPresent() {
        given(candidateRepository.findByUserIdAndDeletedFalse("user1"))
                .willReturn(Optional.of(candidateWithKey));
        given(s3Service.generateFreshUrl("cvs/user1/uuid.pdf")).willReturn("http://refreshed-url");

        String url = candidateService.refreshCvUrl("user1", "cv-1");

        assertThat(url).isEqualTo("http://refreshed-url");
    }

    @Test
    void refreshCvUrl_returnsStoredUrl_whenNoKey() {
        given(candidateRepository.findByUserIdAndDeletedFalse("user2"))
                .willReturn(Optional.of(candidateNoKey));

        String url = candidateService.refreshCvUrl("user2", "cv-2");

        assertThat(url).isEqualTo("http://legacy-url");
    }

    @Test
    void getByUserId_returnsFreshDefaultCvUrl_whenDefaultCvHasS3Key() {
        User user = User.builder().id("user1").email("candidate@example.com").fullName("Candidate").build();
        given(candidateRepository.findByUserIdAndDeletedFalse("user1"))
                .willReturn(Optional.of(candidateWithKey));
        given(userRepository.findById("user1")).willReturn(Optional.of(user));
        given(candidateMapper.toCandidateResponse(candidateWithKey, user))
                .willReturn(CandidateResponse.builder().userId("user1").build());
        given(s3Service.generateFreshUrl("cvs/user1/uuid.pdf")).willReturn("http://fresh-profile-url");

        var response = candidateService.getByUserId("user1");

        assertThat(response.getCvUrl()).isEqualTo("http://fresh-profile-url");
        verify(s3Service).generateFreshUrl("cvs/user1/uuid.pdf");
    }
}
