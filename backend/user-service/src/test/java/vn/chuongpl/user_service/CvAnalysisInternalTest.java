package vn.chuongpl.user_service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.chuongpl.user_service.enums.ErrorCode;
import vn.chuongpl.user_service.exception.AppException;
import vn.chuongpl.user_service.features.candidate.Candidate;
import vn.chuongpl.user_service.features.candidate.CandidateRepository;
import vn.chuongpl.user_service.features.candidate.CandidateService;
import vn.chuongpl.user_service.features.candidate.CvAnalysisStatus;
import vn.chuongpl.user_service.features.candidate.CvItem;
import vn.chuongpl.user_service.features.candidate.dto.CvInfoResponse;
import vn.chuongpl.user_service.integration.notification.CvAnalysisDonePublisher;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CvAnalysisInternalTest {

    @Mock
    CandidateRepository candidateRepository;

    @Mock
    CvAnalysisDonePublisher cvAnalysisDonePublisher;

    @Mock
    vn.chuongpl.user_service.features.servicepackage.ServicePackageRepository servicePackageRepository;

    @Mock
    vn.chuongpl.user_service.integration.notification.AiCreditExhaustedPublisher aiCreditExhaustedPublisher;

    @InjectMocks
    CandidateService candidateService;

    private Candidate candidate;
    private CvItem cv;

    @BeforeEach
    void setUp() {
        cv = CvItem.builder()
                .id("cv-1")
                .url("https://s3.example.com/cvs/cv.pdf")
                .filename("my-cv.pdf")
                .analysisStatus(CvAnalysisStatus.PENDING)
                .build();

        candidate = Candidate.builder()
                .id("cand-1")
                .userId("user-1")
                .cvs(new ArrayList<>(List.of(cv)))
                .build();
    }

    @Test
    void getCvInfo_returns_cv_info_with_owner() {
        when(candidateRepository.findByCvId("cv-1")).thenReturn(Optional.of(candidate));

        CvInfoResponse result = candidateService.getCvInfo("cv-1");

        assertThat(result.cvId()).isEqualTo("cv-1");
        assertThat(result.cvUrl()).isEqualTo("https://s3.example.com/cvs/cv.pdf");
        assertThat(result.filename()).isEqualTo("my-cv.pdf");
        assertThat(result.ownerId()).isEqualTo("user-1");
    }

    @Test
    void getCvInfo_throws_CV_NOT_FOUND_when_no_candidate_owns_the_cv() {
        when(candidateRepository.findByCvId("unknown")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> candidateService.getCvInfo("unknown"))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.CV_NOT_FOUND));
    }

    @Test
    void updateCvAnalysis_sets_result_and_status_then_saves() {
        when(candidateRepository.findByCvId("cv-1")).thenReturn(Optional.of(candidate));
        when(candidateRepository.save(any())).thenReturn(candidate);

        candidateService.updateCvAnalysis("cv-1", "{\"overallScore\":78}", CvAnalysisStatus.DONE);

        ArgumentCaptor<Candidate> captor = ArgumentCaptor.forClass(Candidate.class);
        verify(candidateRepository).save(captor.capture());
        CvItem updated = captor.getValue().getCvs().stream()
                .filter(c -> "cv-1".equals(c.getId()))
                .findFirst().orElseThrow();
        assertThat(updated.getAnalysisResult()).isEqualTo("{\"overallScore\":78}");
        assertThat(updated.getAnalysisStatus()).isEqualTo(CvAnalysisStatus.DONE);
    }

    @Test
    void updateCvAnalysis_throws_CV_NOT_FOUND_when_cv_absent() {
        when(candidateRepository.findByCvId("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> candidateService.updateCvAnalysis("ghost", "{}", CvAnalysisStatus.FAILED))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.CV_NOT_FOUND));
    }
}
