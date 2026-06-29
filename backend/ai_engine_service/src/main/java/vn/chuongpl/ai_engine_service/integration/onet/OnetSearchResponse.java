package vn.chuongpl.ai_engine_service.integration.onet;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record OnetSearchResponse(List<Occupation> occupation) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Occupation(
            String code,
            String title,
            String href
    ) {}
}
