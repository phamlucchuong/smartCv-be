package vn.chuongpl.ai_engine_service.integration.user;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import vn.chuongpl.ai_engine_service.config.RabbitMQConfig;

@Component
@RequiredArgsConstructor
@Slf4j
public class JobSuggestionsPublisher {

    private final RabbitTemplate rabbitTemplate;

    public void publish(JobSuggestionsMessage message) {
        try {
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.JOB_SUGGESTIONS_EXCHANGE,
                    RabbitMQConfig.JOB_SUGGESTIONS_ROUTING_KEY,
                    message);
            log.info("Published job suggestions for userId={}, count={}",
                    message.getUserId(),
                    message.getSuggestions() != null ? message.getSuggestions().size() : 0);
        } catch (Exception e) {
            log.error("[JobSuggestions][Publish] Failed to publish job suggestions for userId={}",
                    message.getUserId(), e);
            throw new RuntimeException("Failed to publish job suggestions", e);
        }
    }
}
