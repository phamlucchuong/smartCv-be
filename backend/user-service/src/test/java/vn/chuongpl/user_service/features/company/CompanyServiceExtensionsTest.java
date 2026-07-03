package vn.chuongpl.user_service.features.company;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import vn.chuongpl.user_service.enums.RecruiterStatus;
import vn.chuongpl.user_service.enums.JobCategory;
import vn.chuongpl.user_service.features.recruiter.Recruiter;

import vn.chuongpl.user_service.features.recruiter.RecruiterRepository;
import vn.chuongpl.user_service.integration.job.JobClient;
import vn.chuongpl.user_service.integration.job.JobSummary;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CompanyServiceExtensionsTest {
    @Mock RecruiterRepository recruiterRepository;
    @Mock MongoTemplate mongoTemplate;
    @Mock JobClient jobClient;
    @InjectMocks CompanyService companyService;

    @Test
    void getCompanyJobs_shouldDelegateToJobClient() {
        JobSummary job = new JobSummary();
        job.setId("j1");
        job.setTitle("Backend Engineer");
        Recruiter recruiter = Recruiter.builder().id("r1").deleted(false).build();
        when(recruiterRepository.findById("r1")).thenReturn(Optional.of(recruiter));
        when(jobClient.getJobsByRecruiter("r1")).thenReturn(List.of(job));

        List<JobSummary> result = companyService.getCompanyJobs("r1");

        assertEquals(1, result.size());
        assertEquals("j1", result.get(0).getId());
        verify(jobClient).getJobsByRecruiter("r1");
    }

    @Test
    void getCompanyJobs_shouldReturnEmptyListWhenJobClientFails() {
        Recruiter recruiter = Recruiter.builder().id("r1").deleted(false).build();
        when(recruiterRepository.findById("r1")).thenReturn(Optional.of(recruiter));
        when(jobClient.getJobsByRecruiter("r1")).thenReturn(List.of());

        List<JobSummary> result = companyService.getCompanyJobs("r1");

        assertTrue(result.isEmpty());
    }

    @Test
    void getRelatedCompanies_shouldReturnSameIndustryCompanies() {
        Recruiter current = Recruiter.builder().id("r1").category(JobCategory.IT_SOFTWARE).status(RecruiterStatus.APPROVED).build();
        Recruiter related = Recruiter.builder().id("r2").companyName("OtherCorp").category(JobCategory.IT_SOFTWARE).status(RecruiterStatus.APPROVED).build();
        when(recruiterRepository.findById("r1")).thenReturn(Optional.of(current));
        when(recruiterRepository.findTop5ByCategoryAndIdNotAndStatusAndDeletedFalse(JobCategory.IT_SOFTWARE, "r1", RecruiterStatus.APPROVED))
                .thenReturn(List.of(related));

        List<CompanyResponse> result = companyService.getRelatedCompanies("r1");

        assertEquals(1, result.size());
        assertEquals("r2", result.get(0).getId());
    }

    @Test
    void getRelatedCompanies_shouldReturnEmptyListWhenNoIndustry() {
        Recruiter current = Recruiter.builder().id("r1").category(null).status(RecruiterStatus.APPROVED).build();
        when(recruiterRepository.findById("r1")).thenReturn(Optional.of(current));

        List<CompanyResponse> result = companyService.getRelatedCompanies("r1");

        assertTrue(result.isEmpty());
        verify(recruiterRepository).findById("r1");
        verifyNoMoreInteractions(recruiterRepository);
    }
}

