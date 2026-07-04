package vn.chuongpl.ai_engine_service.integration.onet;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record OnetEducationResponse(List<ResponseItem> response) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ResponseItem(
            String title,
            @JsonProperty("percentage_of_respondents")
            Integer percentageOfRespondents
    ) {}
}
