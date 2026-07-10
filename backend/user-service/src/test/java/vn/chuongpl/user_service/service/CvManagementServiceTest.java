package vn.chuongpl.user_service.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.chuongpl.user_service.enums.ErrorCode;
import vn.chuongpl.user_service.exception.AppException;
import vn.chuongpl.user_service.features.candidate.Candidate;
import vn.chuongpl.user_service.features.candidate.CandidateMapper;
import vn.chuongpl.user_service.features.candidate.CandidateRepository;
import vn.chuongpl.user_service.features.candidate.CandidateService;
import vn.chuongpl.user_service.features.candidate.CvItem;
import vn.chuongpl.user_service.features.user.UserRepository;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CvManagementServiceTest {
    @Mock CandidateRepository candidateRepository;
    @Mock UserRepository userRepository;
    @Mock CandidateMapper candidateMapper;
    @Mock vn.chuongpl.user_service.features.servicepackage.ServicePackageRepository servicePackageRepository;
    @Mock vn.chuongpl.user_service.integration.notification.AiCreditExhaustedPublisher aiCreditExhaustedPublisher;
    @InjectMocks CandidateService candidateService;

    @Test
    void addCvToList_shouldAppendAndSetDefaultWhenFirst() {
        Candidate c = Candidate.builder().id("c1").userId("u1").cvs(new ArrayList<>()).build();
        when(candidateRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(c));

        candidateService.addCvToList("u1", null, "https://s3/cv1.pdf", "cv1.pdf");

        assertEquals(1, c.getCvs().size());
        assertTrue(c.getCvs().get(0).isDefault());
        assertEquals("https://s3/cv1.pdf", c.getCvUrl());
        verify(candidateRepository).save(c);
    }

    @Test
    void addCvToList_shouldNotSetDefaultWhenOthersExist() {
        CvItem existing = CvItem.builder().id("old").url("old.pdf").isDefault(true).build();
        Candidate c = Candidate.builder().id("c1").userId("u1")
                .cvs(new ArrayList<>(List.of(existing))).build();
        when(candidateRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(c));

        candidateService.addCvToList("u1", null, "https://s3/cv2.pdf", "cv2.pdf");

        assertEquals(2, c.getCvs().size());
        assertFalse(c.getCvs().get(1).isDefault());
        assertTrue(c.getCvs().get(0).isDefault());
    }

    @Test
    void setDefaultCv_shouldSwitchDefaultAndSyncCvUrl() {
        CvItem cv1 = CvItem.builder().id("cv1").url("url1").isDefault(true).build();
        CvItem cv2 = CvItem.builder().id("cv2").url("url2").isDefault(false).build();
        Candidate c = Candidate.builder().id("c1").userId("u1")
                .cvs(new ArrayList<>(List.of(cv1, cv2))).build();
        when(candidateRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(c));

        candidateService.setDefaultCv("u1", "cv2");

        assertFalse(cv1.isDefault());
        assertTrue(cv2.isDefault());
        assertEquals("url2", c.getCvUrl());
        verify(candidateRepository).save(c);
    }

    @Test
    void setDefaultCv_shouldThrowWhenCvNotFound() {
        Candidate c = Candidate.builder().id("c1").userId("u1").cvs(new ArrayList<>()).build();
        when(candidateRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(c));

        AppException ex = assertThrows(AppException.class,
                () -> candidateService.setDefaultCv("u1", "nonexistent"));
        assertEquals(ErrorCode.CV_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    void deleteCv_shouldRemoveCvAndPromoteNextDefault() {
        CvItem cv1 = CvItem.builder().id("cv1").url("url1").isDefault(true)
                .uploadedAt(LocalDateTime.now().minusDays(2)).build();
        CvItem cv2 = CvItem.builder().id("cv2").url("url2").isDefault(false)
                .uploadedAt(LocalDateTime.now().minusDays(1)).build();
        Candidate c = Candidate.builder().id("c1").userId("u1")
                .cvs(new ArrayList<>(List.of(cv1, cv2))).build();
        when(candidateRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(c));

        candidateService.deleteCv("u1", "cv1");

        assertEquals(1, c.getCvs().size());
        assertEquals("cv2", c.getCvs().get(0).getId());
        assertTrue(c.getCvs().get(0).isDefault());
        assertEquals("url2", c.getCvUrl());
        verify(candidateRepository).save(c);
    }
}
