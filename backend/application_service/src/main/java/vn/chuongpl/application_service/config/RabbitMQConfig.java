package vn.chuongpl.application_service.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {
    public static final String EXCHANGE = "application.exchange";
    public static final String APPLICATION_SUBMITTED_KEY = "application.submitted";
    public static final String APPLICATION_SUBMITTED_QUEUE = "application.submitted.queue";
    public static final String APPLICATION_ACCEPTED_KEY = "application.accepted";
    public static final String APPLICATION_REJECTED_KEY = "application.rejected";
    public static final String APPLICATION_WITHDRAWN_KEY = "application.withdrawn";

    @Bean
    DirectExchange applicationExchange() {
        return new DirectExchange(EXCHANGE);
    }

    @Bean Queue applicationSubmittedQueue() { return new Queue(APPLICATION_SUBMITTED_QUEUE, true); }
    @Bean Queue acceptedQueue() { return new Queue("application.accepted.queue"); }
    @Bean Queue rejectedQueue() { return new Queue("application.rejected.queue"); }
    @Bean Queue withdrawnQueue() { return new Queue("application.withdrawn.queue"); }

    @Bean
    Binding applicationSubmittedBinding(@Qualifier("applicationExchange") DirectExchange e) {
        return BindingBuilder.bind(applicationSubmittedQueue()).to(e).with(APPLICATION_SUBMITTED_KEY);
    }

    @Bean
    Binding acceptedBinding(@Qualifier("applicationExchange") DirectExchange e) {
        return BindingBuilder.bind(acceptedQueue()).to(e).with(APPLICATION_ACCEPTED_KEY);
    }

    @Bean
    Binding rejectedBinding(@Qualifier("applicationExchange") DirectExchange e) {
        return BindingBuilder.bind(rejectedQueue()).to(e).with(APPLICATION_REJECTED_KEY);
    }

    @Bean
    Binding withdrawnBinding(@Qualifier("applicationExchange") DirectExchange e) {
        return BindingBuilder.bind(withdrawnQueue()).to(e).with(APPLICATION_WITHDRAWN_KEY);
    }

    public static final String CV_SCORING_EXCHANGE = "cv.scoring.exchange";
    public static final String CV_SCORING_KEY      = "cv.scoring";

    @Bean DirectExchange cvScoringExchange() {
        return new DirectExchange(CV_SCORING_EXCHANGE);
    }

    @Bean Queue cvScoringQueue() {
        return new Queue("cv.scoring.queue", true);
    }

    @Bean Binding cvScoringBinding() {
        return BindingBuilder.bind(cvScoringQueue()).to(cvScoringExchange()).with(CV_SCORING_KEY);
    }

    public static final String ASSESSMENT_EXCHANGE = "assessment.exchange";
    public static final String ASSESSMENT_SUBMITTED_KEY = "assessment.submitted";
    public static final String ASSESSMENT_SUBMITTED_QUEUE = "assessment.submitted.queue";

    @Bean DirectExchange assessmentExchange() { return new DirectExchange(ASSESSMENT_EXCHANGE); }
    @Bean Queue assessmentSubmittedQueue() { return new Queue(ASSESSMENT_SUBMITTED_QUEUE, true); }
    @Bean Binding assessmentSubmittedBinding(@Qualifier("assessmentExchange") DirectExchange e) {
        return BindingBuilder.bind(assessmentSubmittedQueue()).to(e).with(ASSESSMENT_SUBMITTED_KEY);
    }

    @Bean
    MessageConverter jackson2MessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
