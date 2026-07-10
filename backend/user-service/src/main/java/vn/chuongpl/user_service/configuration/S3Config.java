package vn.chuongpl.user_service.configuration;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;

@Configuration
@Slf4j
public class S3Config {

    @Value("${AWS_REGION:ap-southeast-1}")
    String region;

    @Value("${AWS_ACCESS_KEY_ID:}")
    String accessKey;

    @Value("${AWS_SECRET_ACCESS_KEY:}")
    String secretKey;

    @Value("${AWS_S3_ENDPOINT_URL:}")
    String endpointUrl;

    @PostConstruct
    public void validateCredentials() {
        if (accessKey.isBlank() || secretKey.isBlank()) {
            log.warn("[S3Config] AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY is empty — presigned URLs will be malformed. Run via 'make run-user' from backend/ or set these env vars in your IDE run config.");
        } else {
            log.debug("[S3Config] AWS credentials loaded: key={}*** region={} bucket-env-check={}",
                    accessKey.substring(0, Math.min(4, accessKey.length())), region, endpointUrl.isBlank() ? "AWS" : "MinIO");
        }
    }

    @Bean
    public S3Client s3Client() {
        AwsBasicCredentials creds = AwsBasicCredentials.create(accessKey, secretKey);
        var builder = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(creds));
        if (!endpointUrl.isBlank()) {
            builder.endpointOverride(URI.create(endpointUrl))
                    .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build());
        }
        return builder.build();
    }

    @Bean
    public S3Presigner s3Presigner() {
        AwsBasicCredentials creds = AwsBasicCredentials.create(accessKey, secretKey);
        var builder = S3Presigner.builder()
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(creds));
        if (!endpointUrl.isBlank()) {
            builder.endpointOverride(URI.create(endpointUrl))
                    .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build());
        }
        return builder.build();
    }
}
