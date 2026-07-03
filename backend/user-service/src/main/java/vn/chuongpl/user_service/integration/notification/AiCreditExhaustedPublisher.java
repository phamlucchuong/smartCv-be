package vn.chuongpl.user_service.integration.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.AmqpTemplate;
import org.springframework.stereotype.Component;
import vn.chuongpl.user_service.configuration.RabbitMQConfig;
import vn.chuongpl.user_service.dtos.message.AiCreditExhaustedMessage;

@Component
@RequiredArgsConstructor
@Slf4j
public class AiCreditExhaustedPublisher {

    private final AmqpTemplate amqpTemplate;

    public void publish(String userId, String userRole) {
        try {
            amqpTemplate.convertAndSend(
                    RabbitMQConfig.RECRUITER_EXCHANGE,
                    RabbitMQConfig.AI_CREDIT_EXHAUSTED_KEY,
                    AiCreditExhaustedMessage.builder()
                            .userId(userId)
                            .userRole(userRole)
                            .build()
            );
        } catch (Exception e) {
            log.warn("Failed to publish ai-credit-exhausted event for userId={}: {}", userId, e.getMessage());
        }
    }
}
