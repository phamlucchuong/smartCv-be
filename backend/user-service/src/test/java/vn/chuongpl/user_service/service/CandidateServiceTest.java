package vn.chuongpl.user_service.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.chuongpl.user_service.dtos.request.CandidateRequest;
import vn.chuongpl.user_service.enums.ErrorCode;
import vn.chuongpl.user_service.exception.AppException;
import vn.chuongpl.user_service.features.candidate.Candidate;
import vn.chuongpl.user_service.features.candidate.CandidateMapper;
import vn.chuongpl.user_service.features.candidate.CandidateRepository;
import vn.chuongpl.user_service.features.candidate.CandidateService;
import vn.chuongpl.user_service.features.servicepackage.ServicePackage;
import vn.chuongpl.user_service.features.servicepackage.ServicePackageRepository;
import vn.chuongpl.user_service.features.user.User;
import vn.chuongpl.user_service.features.user.UserRepository;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CandidateServiceTest {

    @Mock
    CandidateRepository candidateRepository;
    @Mock
    UserRepository userRepository;
    @Mock
    CandidateMapper candidateMapper;
    @Mock
    ServicePackageRepository servicePackageRepository;
    @Mock
    vn.chuongpl.user_service.integration.notification.AiCreditExhaustedPublisher aiCreditExhaustedPublisher;

    @InjectMocks
    CandidateService candidateService;

    @Test
    void create_shouldThrowWhenDuplicateUserId() {
        CandidateRequest request = CandidateRequest.builder().userId("u1").build();
        when(userRepository.findById("u1")).thenReturn(Optional.of(User.builder().id("u1").build()));
        when(candidateRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(Candidate.builder().id("c1").userId("u1").build()));

        AppException ex = assertThrows(AppException.class, () -> candidateService.create(request));
        assertEquals(ErrorCode.CANDIDATE_EXISTED, ex.getErrorCode());
    }

    @Test
    void mergeSkills_shouldDeduplicateCaseInsensitiveAndIgnoreBlankValues() {
        Candidate candidate = Candidate.builder()
                .id("c1")
                .userId("u1")
                .skills(new ArrayList<>(List.of("Java", "Spring Boot")))
                .build();
        when(candidateRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(candidate));

        candidateService.mergeSkills("u1", Arrays.asList("java", "Docker", " ", null, "SPRING BOOT", "Kubernetes"));

        assertEquals(List.of("Java", "Spring Boot", "Docker", "Kubernetes"), candidate.getSkills());
        assertTrue(candidate.getUpdatedAt() != null);
        verify(candidateRepository).save(candidate);
    }

    @Test
    void mergeSkills_shouldAppendOnlyNewSkills_caseInsensitive() {
        Candidate candidate = Candidate.builder()
                .id("c1")
                .userId("u1")
                .skills(List.of("Java", "Docker"))
                .build();
        when(candidateRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(candidate));

        candidateService.mergeSkills("u1", Arrays.asList(null, " ", "java", "Kubernetes", "DOCKER", "Spring Boot", "kubernetes"));

        assertEquals(List.of("Java", "Docker", "Kubernetes", "Spring Boot"), candidate.getSkills());
        assertNotNull(candidate.getUpdatedAt());
        verify(candidateRepository).save(candidate);
    }

    @Test
    void createBasicProfile_shouldCreateCandidateWhenMissing() {
        when(candidateRepository.findByUserIdAndDeletedFalse("u2")).thenReturn(Optional.empty());

        candidateService.createBasicProfile("u2");

        verify(candidateRepository).save(any(Candidate.class));
    }

    @Test
    void mergeSkills_shouldThrowWhenCandidateMissing() {
        when(candidateRepository.findByUserIdAndDeletedFalse("missing")).thenReturn(Optional.empty());

        AppException ex = assertThrows(AppException.class, () -> candidateService.mergeSkills("missing", List.of("Java")));

        assertEquals(ErrorCode.CANDIDATE_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    void getByUserId_shouldExposeAiCreditSummaryForBilling() {
        Candidate candidate = Candidate.builder()
                .id("c1")
                .userId("u1")
                .activePackageId("plus")
                .monthlyAiCreditsUsed(7)
                .monthlyAiCreditsMonth(java.time.YearMonth.now().toString())
                .build();
        User user = User.builder().id("u1").fullName("Jane").build();
        var mapped = vn.chuongpl.user_service.dtos.response.CandidateResponse.builder().id("c1").build();
        ServicePackage activePackage = ServicePackage.builder().id("plus").aiCredits(20).build();

        when(candidateRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(candidate));
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));
        when(candidateMapper.toCandidateResponse(candidate, user)).thenReturn(mapped);
        when(servicePackageRepository.findById("plus")).thenReturn(Optional.of(activePackage));

        var response = candidateService.getByUserId("u1");

        assertEquals(20, response.getAiCreditsTotal());
        assertEquals(7, response.getAiCreditsUsed());
        assertEquals(13, response.getAiCreditsRemaining());
    }
}
