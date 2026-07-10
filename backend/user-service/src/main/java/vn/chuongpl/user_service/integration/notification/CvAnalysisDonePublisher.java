package vn.chuongpl.user_service.integration.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.AmqpTemplate;
import org.springframework.stereotype.Component;
import vn.chuongpl.user_service.configuration.RabbitMQConfig;

@Component
@RequiredArgsConstructor
@Slf4j
public class CvAnalysisDonePublisher {

    private final AmqpTemplate amqpTemplate;

    public void publish(String userId, String cvId, String filename) {
        try {
            amqpTemplate.convertAndSend(
                    RabbitMQConfig.CV_ANALYSIS_EXCHANGE,
                    RabbitMQConfig.CV_ANALYSIS_DONE_KEY,
                    new CvAnalysisDoneMessage(userId, cvId, filename)
            );
        } catch (Exception e) {
            log.warn("Failed to publish cv-analysis-done event for userId={} cvId={}: {}", userId, cvId, e.getMessage());
        }
    }
}
