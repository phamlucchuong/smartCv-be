package vn.chuongpl.ai_engine_service.integration.onet;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record OnetSkillsResponse(List<Element> element) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Element(
            String name,
            String description
    ) {}
}
