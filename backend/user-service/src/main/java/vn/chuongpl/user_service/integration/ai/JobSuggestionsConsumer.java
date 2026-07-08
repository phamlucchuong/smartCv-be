package vn.chuongpl.user_service.integration.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import vn.chuongpl.user_service.configuration.RabbitMQConfig;
import vn.chuongpl.user_service.features.candidate.CandidateService;

@Component
@RequiredArgsConstructor
@Slf4j
public class JobSuggestionsConsumer {
    private final CandidateService candidateService;

    @RabbitListener(queues = RabbitMQConfig.JOB_SUGGESTIONS_QUEUE)
    public void consume(JobSuggestionsMessage message) {
        log.info("Received job suggestions for userId={}, count={}",
                message.getUserId(), message.getSuggestions() != null ? message.getSuggestions().size() : 0);
        try {
            candidateService.updateJobSuggestions(message.getUserId(), message.getSuggestions());
        } catch (Exception e) {
            log.error("[JobSuggestions][Consume] Failed to update job suggestions for userId={}",
                    message.getUserId(), e);
            throw new RuntimeException("Failed to process job suggestions", e);
        }
    }
}
