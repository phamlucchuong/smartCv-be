package vn.chuongpl.ai_engine_service.integration.onet;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import vn.chuongpl.ai_engine_service.config.OnetProperties;

@Component
@RequiredArgsConstructor
public class OnetClient {

    private final RestTemplate restTemplate;
    private final OnetProperties properties;

    public OnetSearchResponse searchOccupations(String keyword, int limit) {
        String url = UriComponentsBuilder.fromHttpUrl(baseUrl() + "/online/search")
                .queryParam("keyword", keyword)
                .queryParam("end", Math.max(limit, 1))
                .build()
                .toUriString();
        return exchange(url, OnetSearchResponse.class);
    }

    public OnetOverviewResponse getOverview(String occupationCode) {
        return exchange(baseUrl() + "/online/occupations/" + occupationCode + "/", OnetOverviewResponse.class);
    }

    public OnetJobZoneResponse getJobZone(String occupationCode) {
        return exchange(baseUrl() + "/online/occupations/" + occupationCode + "/summary/job_zone", OnetJobZoneResponse.class);
    }

    public OnetTasksResponse getTasks(String occupationCode) {
        return exchange(baseUrl() + "/online/occupations/" + occupationCode + "/summary/tasks", OnetTasksResponse.class);
    }

    public OnetSkillsResponse getSkills(String occupationCode) {
        return exchange(baseUrl() + "/online/occupations/" + occupationCode + "/summary/skills", OnetSkillsResponse.class);
    }

    public OnetKnowledgeResponse getKnowledge(String occupationCode) {
        return exchange(baseUrl() + "/online/occupations/" + occupationCode + "/summary/knowledge", OnetKnowledgeResponse.class);
    }

    public OnetTechnologySkillsResponse getTechnologySkills(String occupationCode) {
        return exchange(baseUrl() + "/online/occupations/" + occupationCode + "/summary/technology_skills", OnetTechnologySkillsResponse.class);
    }

    public OnetEducationResponse getEducation(String occupationCode) {
        return exchange(baseUrl() + "/online/occupations/" + occupationCode + "/summary/education", OnetEducationResponse.class);
    }

    private <T> T exchange(String url, Class<T> responseType) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBasicAuth(properties.getUsername(), properties.getPassword());
        headers.setAccept(java.util.List.of(MediaType.APPLICATION_JSON));
        return restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), responseType).getBody();
    }

    private String baseUrl() {
        return properties.getBaseUrl().endsWith("/")
                ? properties.getBaseUrl().substring(0, properties.getBaseUrl().length() - 1)
                : properties.getBaseUrl();
    }
}
