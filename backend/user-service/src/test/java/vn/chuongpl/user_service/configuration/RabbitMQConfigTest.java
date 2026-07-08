package vn.chuongpl.user_service.configuration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.support.converter.MessageConverter;
import vn.chuongpl.user_service.features.candidate.JobSuggestion;
import vn.chuongpl.user_service.integration.ai.JobSuggestionsMessage;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class RabbitMQConfigTest {

    private final RabbitMQConfig config = new RabbitMQConfig();

    @Test
    void jobSuggestionsQueue_hasDeadLetterConfiguration() {
        Queue queue = config.jobSuggestionsQueue();

        assertThat(queue.getArguments())
                .containsEntry("x-dead-letter-exchange", RabbitMQConfig.JOB_SUGGESTIONS_DLQ_EXCHANGE)
                .containsEntry("x-dead-letter-routing-key", RabbitMQConfig.JOB_SUGGESTIONS_DLQ_ROUTING_KEY);
    }

    @Test
    void converter_prefersInferredListenerTypeForForeignTypeIdHeader() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
        MessageConverter converter = config.converter(objectMapper);

        byte[] body = objectMapper.writeValueAsBytes(Map.of(
                "userId", "u1",
                "suggestions", List.of(Map.of(
                        "jobId", "job-1",
                        "matchScore", 91,
                        "matchReason", "Strong match",
                        "alignedSkills", List.of("Java", "Spring Boot")
                ))
        ));

        MessageProperties properties = new MessageProperties();
        properties.setContentType(MessageProperties.CONTENT_TYPE_JSON);
        properties.setContentEncoding(StandardCharsets.UTF_8.name());
        properties.setHeader("__TypeId__", "vn.chuongpl.ai_engine_service.integration.user.JobSuggestionsMessage");
        properties.setInferredArgumentType(JobSuggestionsMessage.class);
        Message message = new Message(body, properties);

        Object converted = converter.fromMessage(message);

        assertThat(converted).isInstanceOf(JobSuggestionsMessage.class);
        JobSuggestionsMessage payload = (JobSuggestionsMessage) converted;
        assertThat(payload.getUserId()).isEqualTo("u1");
        assertThat(payload.getSuggestions())
                .extracting(JobSuggestion::getJobId, JobSuggestion::getMatchScore)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("job-1", 91));
    }
}
