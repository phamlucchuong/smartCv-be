package vn.chuongpl.ai_engine_service.integration.onet;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import vn.chuongpl.ai_engine_service.config.OnetProperties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class OnetClientTest {

    private RestTemplate restTemplate;
    private MockRestServiceServer server;
    private OnetClient client;

    @BeforeEach
    void setUp() {
        restTemplate = new RestTemplate();
        server = MockRestServiceServer.createServer(restTemplate);
        OnetProperties properties = new OnetProperties();
        properties.setEnabled(true);
        properties.setBaseUrl("https://api-v2.onetcenter.org");
        properties.setApiKey("test-api-key");
        properties.setSearchLimit(5);
        client = new OnetClient(restTemplate, properties);
    }

    @Test
    void searchOccupations_calls_keyword_search_with_api_key_header() {
        server.expect(requestTo("https://api-v2.onetcenter.org/online/search?keyword=backend%20engineer&end=5"))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header("X-API-Key", "test-api-key"))
                .andRespond(withSuccess("""
                        {"occupation":[{"code":"15-1252.00","title":"Software Developers","href":"x"}]}
                        """, MediaType.APPLICATION_JSON));

        OnetSearchResponse response = client.searchOccupations("backend engineer", 5);

        assertThat(response.occupation()).hasSize(1);
        assertThat(response.occupation().getFirst().code()).isEqualTo("15-1252.00");
    }

    @Test
    void getTasks_calls_summary_endpoint() {
        server.expect(requestTo("https://api-v2.onetcenter.org/online/occupations/15-1252.00/summary/tasks"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        {"task":[{"title":"Develop and test software applications."}]}
                        """, MediaType.APPLICATION_JSON));

        OnetTasksResponse response = client.getTasks("15-1252.00");

        assertThat(response.task()).hasSize(1);
        assertThat(response.task().getFirst().title()).contains("Develop and test");
    }
}
