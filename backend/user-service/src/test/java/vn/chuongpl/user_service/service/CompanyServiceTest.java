package vn.chuongpl.user_service.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import vn.chuongpl.user_service.dtos.PageResponse;
import vn.chuongpl.user_service.enums.ErrorCode;
import vn.chuongpl.user_service.enums.RecruiterStatus;
import vn.chuongpl.user_service.exception.AppException;
import vn.chuongpl.user_service.features.company.CompanyResponse;
import vn.chuongpl.user_service.features.company.CompanyService;
import vn.chuongpl.user_service.features.recruiter.Recruiter;
import vn.chuongpl.user_service.features.recruiter.RecruiterRepository;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CompanyServiceTest {
    @Mock RecruiterRepository recruiterRepository;
    @Mock MongoTemplate mongoTemplate;
    @InjectMocks CompanyService companyService;

    @Test
    void getAll_shouldReturnPagedApprovedCompanies() {
        Recruiter r = Recruiter.builder().id("r1").companyName("ACME")
                .status(RecruiterStatus.APPROVED).deleted(false).build();
        when(mongoTemplate.find(any(Query.class), eq(Recruiter.class))).thenReturn(List.of(r));
        when(mongoTemplate.count(any(Query.class), eq(Recruiter.class))).thenReturn(1L);

        PageResponse<CompanyResponse> result = companyService.getAll(1, 10, null, null, null, null, null);

        assertEquals(1, result.getItems().size());
        assertEquals("ACME", result.getItems().get(0).getName());
        assertEquals(1L, result.getTotal());
    }

    @Test
    void getById_shouldThrowWhenRecruiterNotFound() {
        when(recruiterRepository.findById("x")).thenReturn(Optional.empty());

        AppException ex = assertThrows(AppException.class, () -> companyService.getById("x"));
        assertEquals(ErrorCode.COMPANY_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    void getById_shouldThrowWhenStatusNotApproved() {
        Recruiter pending = Recruiter.builder().id("r1")
                .status(RecruiterStatus.PENDING).deleted(false).build();
        when(recruiterRepository.findById("r1")).thenReturn(Optional.of(pending));

        AppException ex = assertThrows(AppException.class, () -> companyService.getById("r1"));
        assertEquals(ErrorCode.COMPANY_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    void getById_shouldReturnCompanyWithNullActiveJobCount() {
        Recruiter approved = Recruiter.builder().id("r1").companyName("ACME Inc")
                .status(RecruiterStatus.APPROVED).deleted(false).build();
        when(recruiterRepository.findById("r1")).thenReturn(Optional.of(approved));

        CompanyResponse result = companyService.getById("r1");

        assertEquals("ACME Inc", result.getName());
        assertNull(result.getActiveJobCount());
    }

    @Test
    void getByRecruiterId_shouldReturnCompanyByUserId() {
        Recruiter approved = Recruiter.builder().id("company-uuid").companyName("TechCorp")
                .status(RecruiterStatus.APPROVED).deleted(false).build();
        when(recruiterRepository.findById("user-uuid")).thenReturn(Optional.of(approved));

        CompanyResponse result = companyService.getByRecruiterId("user-uuid");

        assertEquals("company-uuid", result.getId());
        assertEquals("TechCorp", result.getName());
    }

    @Test
    void getByRecruiterId_shouldThrowWhenNotFound() {
        when(recruiterRepository.findById("unknown")).thenReturn(Optional.empty());

        AppException ex = assertThrows(AppException.class, () -> companyService.getByRecruiterId("unknown"));
        assertEquals(ErrorCode.COMPANY_NOT_FOUND, ex.getErrorCode());
    }

    @Test
    void getByRecruiterId_shouldThrowWhenNotApproved() {
        Recruiter pending = Recruiter.builder().id("r1")
                .status(RecruiterStatus.PENDING).deleted(false).build();
        when(recruiterRepository.findById("user-uuid")).thenReturn(Optional.of(pending));

        AppException ex = assertThrows(AppException.class, () -> companyService.getByRecruiterId("user-uuid"));
        assertEquals(ErrorCode.COMPANY_NOT_FOUND, ex.getErrorCode());
    }
}
