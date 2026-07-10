package vn.chuongpl.job_service.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.*;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {
    public static final String EXCHANGE = "job.exchange";
    public static final String JOB_CREATED_QUEUE = "job.created.queue";
    public static final String JOB_UPDATED_QUEUE = "job.updated.queue";
    public static final String JOB_CLOSED_QUEUE = "job.closed.queue";

    public static final String JOB_CREATED_ROUTING_KEY = "job.created";
    public static final String JOB_UPDATED_ROUTING_KEY = "job.updated";
    public static final String JOB_CLOSED_ROUTING_KEY = "job.closed";

    public static final String JOB_APPROVED_QUEUE = "job.approved.queue";
    public static final String JOB_REJECTED_QUEUE = "job.rejected.queue";
    public static final String JOB_APPROVED_KEY = "job.approved";
    public static final String JOB_REJECTED_KEY = "job.rejected";

    @Bean
    public MessageConverter messageConverter(ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(objectMapper);
    }

    @Bean
    DirectExchange jobExchange() {
        return new DirectExchange(EXCHANGE);
    }

    @Bean
    Queue jobCreatedQueue() { return new Queue(JOB_CREATED_QUEUE); }

    @Bean
    Queue jobUpdatedQueue() { return new Queue(JOB_UPDATED_QUEUE); }

    @Bean
    Queue jobClosedQueue() { return new Queue(JOB_CLOSED_QUEUE); }

    @Bean
    Binding bindCreatedQueue(Queue jobCreatedQueue, DirectExchange jobExchange) {
        return BindingBuilder.bind(jobCreatedQueue).to(jobExchange).with(JOB_CREATED_ROUTING_KEY);
    }

    @Bean
    Binding bindUpdatedQueue(Queue jobUpdatedQueue, DirectExchange jobExchange) {
        return BindingBuilder.bind(jobUpdatedQueue).to(jobExchange).with(JOB_UPDATED_ROUTING_KEY);
    }

    @Bean
    Binding bindClosedQueue(Queue jobClosedQueue, DirectExchange jobExchange) {
        return BindingBuilder.bind(jobClosedQueue).to(jobExchange).with(JOB_CLOSED_ROUTING_KEY);
    }

    @Bean
    Queue jobApprovedQueue() { return new Queue(JOB_APPROVED_QUEUE, true); }

    @Bean
    Queue jobRejectedQueue() { return new Queue(JOB_REJECTED_QUEUE, true); }

    @Bean
    Binding bindApprovedQueue(Queue jobApprovedQueue, DirectExchange jobExchange) {
        return BindingBuilder.bind(jobApprovedQueue).to(jobExchange).with(JOB_APPROVED_KEY);
    }

    @Bean
    Binding bindRejectedQueue(Queue jobRejectedQueue, DirectExchange jobExchange) {
        return BindingBuilder.bind(jobRejectedQueue).to(jobExchange).with(JOB_REJECTED_KEY);
    }
}
