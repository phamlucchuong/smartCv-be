package vn.chuongpl.ai_engine_service.integration.onet;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record OnetTasksResponse(List<Task> task) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Task(String title) {}
}
