package vn.chuongpl.ai_engine_service.integration.onet;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record OnetOverviewResponse(
        String code,
        String title,
        String description,
        @JsonProperty("sample_of_reported_titles")
        List<String> sampleOfReportedTitles
) {}
