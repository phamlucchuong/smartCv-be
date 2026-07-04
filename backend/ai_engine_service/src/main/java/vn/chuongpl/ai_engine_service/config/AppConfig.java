package vn.chuongpl.ai_engine_service.config;

import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@Configuration
@EnableConfigurationProperties({AiProviderProperties.class, OnetProperties.class})
public class AppConfig {
    @Bean
    RestTemplate restTemplate() {
        // HttpURLConnection (default) doesn't support PATCH — use Apache HttpClient 5
        return new RestTemplate(new HttpComponentsClientHttpRequestFactory(HttpClients.createDefault()));
    }
}
