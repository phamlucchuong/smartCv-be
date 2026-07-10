package vn.chuongpl.ai_engine_service.integration.onet;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record OnetJobZoneResponse(
        String code,
        String title,
        @JsonProperty("job_zone")
        String jobZone,
        String education,
        @JsonProperty("related_experience")
        String relatedExperience
) {}
