package vn.chuongpl.user_service.integration.notification;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import vn.chuongpl.user_service.configuration.RabbitMQConfig;
import vn.chuongpl.user_service.dtos.message.OTPMessage;

import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class NotificationClient {
    private static final int OTP_TTL_MINUTES = 5;

    RestTemplate restTemplate;
    RabbitTemplate rabbitTemplate;

    @NonFinal
    @Value("${NOTIFICATION_SERVICE_URL:http://localhost:8084}")
    String notificationServiceUrl;

    public void sendOTP(String target, String targetType) {
        sendOTP(target, targetType, "VERIFY_ACCOUNT");
    }

    public void sendOTP(String target, String targetType, String otpType) {
        OTPMessage message = OTPMessage.builder()
                .target(target)
                .targetType(targetType)
                .otpType(otpType)
                .ttlMinutes(OTP_TTL_MINUTES)
                .build();
        rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE, RabbitMQConfig.ROUTING_KEY, message);
    }

    public boolean verifyOTP(String target, String targetType, String code) {
        return verifyOTP(target, targetType, code, "VERIFY_ACCOUNT");
    }

    public boolean verifyOTP(String target, String targetType, String code, String otpType) {
        String url = notificationServiceUrl + "/notification/api/otp/verify";
        Map<String, Object> request = new HashMap<>();
        request.put("target", target);
        request.put("target_type", targetType);
        request.put("code", code);
        request.put("otp_type", otpType);

        try {
            restTemplate.postForObject(url, request, Void.class);
            return true;
        } catch (Exception e) {
            System.err.println("Error verifying OTP: " + e.getMessage());
            return false;
        }
    }
}
