package vn.chuongpl.payment_service.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import vn.payos.PayOS;

@Configuration
@ConfigurationProperties(prefix = "payos")
@Getter
@Setter
public class PayOSConfig {
    String clientId;
    String apiKey;
    String checksumKey;
    String webhookToken;
    String returnUrl;
    String cancelUrl;

    @Bean
    public PayOS payOS() {
        return new PayOS(clientId, apiKey, checksumKey);
    }
}
