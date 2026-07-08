package vn.chuongpl.user_service.integration.ai;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.chuongpl.user_service.features.candidate.CandidateService;
import vn.chuongpl.user_service.features.candidate.JobSuggestion;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class JobSuggestionsConsumerTest {

    @Mock
    CandidateService candidateService;

    JobSuggestionsConsumer consumer;

    @BeforeEach
    void setUp() {
        consumer = new JobSuggestionsConsumer(candidateService);
    }

    @Test
    void consume_exceptionPropagatesForDlqRouting() {
        JobSuggestionsMessage message = new JobSuggestionsMessage();
        message.setUserId("u1");
        message.setSuggestions(List.of(JobSuggestion.builder().jobId("job-1").build()));
        doThrow(new RuntimeException("DB error"))
                .when(candidateService).updateJobSuggestions("u1", message.getSuggestions());

        assertThrows(RuntimeException.class, () -> consumer.consume(message));
        verify(candidateService).updateJobSuggestions("u1", message.getSuggestions());
    }
}
