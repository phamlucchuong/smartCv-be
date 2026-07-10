package vn.chuongpl.application_service.integration.notification;

import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import vn.chuongpl.application_service.config.RabbitMQConfig;
import vn.chuongpl.application_service.features.assessment.AssessmentEventMessage;

@Component
@RequiredArgsConstructor
public class AssessmentNotificationPublisher {

    final RabbitTemplate rabbitTemplate;

    public void publishAssessmentSubmitted(AssessmentEventMessage message) {
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.ASSESSMENT_EXCHANGE,
                RabbitMQConfig.ASSESSMENT_SUBMITTED_KEY,
                message);
    }
}
