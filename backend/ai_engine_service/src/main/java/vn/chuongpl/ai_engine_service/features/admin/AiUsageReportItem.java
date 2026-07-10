package vn.chuongpl.ai_engine_service.features.admin;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AiUsageReportItem {
    private String date;
    private int promptTokens;
    private int completionTokens;
    private double cost;
}
