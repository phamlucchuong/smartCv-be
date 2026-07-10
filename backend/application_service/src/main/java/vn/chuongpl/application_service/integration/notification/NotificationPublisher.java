package vn.chuongpl.application_service.integration.notification;

import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import vn.chuongpl.application_service.config.RabbitMQConfig;
import vn.chuongpl.application_service.features.application.Application;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class NotificationPublisher {

    final RabbitTemplate rabbitTemplate;

    public void publishNewApplication(Application application, String recruiterUserId) {
        ApplicationEventMessage message = ApplicationEventMessage.builder()
                .applicationId(application.getId())
                .candidateId(application.getCandidateId())
                .candidateEmail(application.getCandidateEmail())
                .recruiterId(application.getRecruiterId())
                .recruiterUserId(recruiterUserId)
                .jobId(application.getJobId())
                .jobTitle(application.getJobTitle())
                .newStatus("SUBMITTED")
                .occurredAt(LocalDateTime.now())
                .build();
        rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, RabbitMQConfig.APPLICATION_SUBMITTED_KEY, message);
    }

    public void publishStatusChanged(Application application) {
        ApplicationEventMessage message = ApplicationEventMessage.builder()
                .applicationId(application.getId())
                .candidateId(application.getCandidateId())
                .candidateEmail(application.getCandidateEmail())
                .recruiterId(application.getRecruiterId())
                .jobId(application.getJobId())
                .jobTitle(application.getJobTitle())
                .newStatus(application.getStatus().name())
                .rejectionReason(application.getRejectionReason())
                .occurredAt(LocalDateTime.now())
                .build();

        String routingKey = switch (application.getStatus()) {
            case ACCEPTED -> RabbitMQConfig.APPLICATION_ACCEPTED_KEY;
            case REJECTED -> RabbitMQConfig.APPLICATION_REJECTED_KEY;
            case WITHDRAWN -> RabbitMQConfig.APPLICATION_WITHDRAWN_KEY;
            default -> null;
        };

        if (routingKey != null) {
            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, routingKey, message);
        }
    }
}
