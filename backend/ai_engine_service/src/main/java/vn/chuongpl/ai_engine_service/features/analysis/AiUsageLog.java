package vn.chuongpl.ai_engine_service.features.analysis;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "ai_usage_logs")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiUsageLog {
    @Id
    private String id;
    private String provider;
    private int promptTokens;
    private int completionTokens;
    private double cost;
    private LocalDateTime createdAt;
}
