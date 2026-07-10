package vn.chuongpl.ai_engine_service.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.onet")
@Data
public class OnetProperties {
    private boolean enabled;
    private String baseUrl = "https://api-v2.onetcenter.org";
    private String apiKey;
    private int searchLimit = 5;

    public boolean isConfigured() {
        return enabled && apiKey != null && !apiKey.isBlank();
    }
}
