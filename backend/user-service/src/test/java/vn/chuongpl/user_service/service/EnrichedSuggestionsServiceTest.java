package vn.chuongpl.user_service.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.chuongpl.user_service.features.candidate.*;
import vn.chuongpl.user_service.features.candidate.settings.CandidateSettings;
import vn.chuongpl.user_service.features.user.UserRepository;
import vn.chuongpl.user_service.integration.job.JobClient;
import vn.chuongpl.user_service.integration.job.JobSummary;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EnrichedSuggestionsServiceTest {
    @Mock CandidateRepository candidateRepository;
    @Mock UserRepository userRepository;
    @Mock CandidateMapper candidateMapper;
    @Mock JobClient jobClient;
    @InjectMocks CandidateService candidateService;

    @Test
    void getEnrichedJobSuggestions_shouldMergeJobDataIntoBySuggestions() {
        JobSuggestion suggestion = JobSuggestion.builder()
                .jobId("j1").matchScore(90).matchReason("Good match").alignedSkills(List.of("Java")).build();
        Candidate c = Candidate.builder().userId("u1")
                .jobSuggestions(new ArrayList<>(List.of(suggestion)))
                .settings(new CandidateSettings())
                .build();
        when(candidateRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(c));

        JobSummary jobSummary = new JobSummary();
        jobSummary.setId("j1");
        jobSummary.setTitle("Backend Engineer");
        when(jobClient.getJobsByIds(List.of("j1"))).thenReturn(List.of(jobSummary));

        List<EnrichedJobSuggestion> result = candidateService.getEnrichedJobSuggestions("u1");

        assertEquals(1, result.size());
        assertEquals("j1", result.get(0).getJobId());
        assertEquals(90, result.get(0).getMatchScore());
        assertNotNull(result.get(0).getJob());
        assertEquals("Backend Engineer", result.get(0).getJob().getTitle());
    }

    @Test
    void getEnrichedJobSuggestions_shouldFilterOutSuggestionsWhenJobDetailsCannotBeResolved() {
        JobSuggestion suggestion = JobSuggestion.builder()
                .jobId("j1").matchScore(80).build();
        Candidate c = Candidate.builder().userId("u1")
                .jobSuggestions(new ArrayList<>(List.of(suggestion)))
                .settings(new CandidateSettings())
                .build();
        when(candidateRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(c));
        when(jobClient.getJobsByIds(List.of("j1"))).thenReturn(List.of());

        List<EnrichedJobSuggestion> result = candidateService.getEnrichedJobSuggestions("u1");

        assertTrue(result.isEmpty());
    }

    @Test
    void getEnrichedJobSuggestions_shouldReturnEmptyListWhenNoSuggestions() {
        Candidate c = Candidate.builder().userId("u1")
                .jobSuggestions(new ArrayList<>())
                .settings(new CandidateSettings())
                .build();
        when(candidateRepository.findByUserIdAndDeletedFalse("u1")).thenReturn(Optional.of(c));

        List<EnrichedJobSuggestion> result = candidateService.getEnrichedJobSuggestions("u1");

        assertTrue(result.isEmpty());
        verifyNoInteractions(jobClient);
    }
}
