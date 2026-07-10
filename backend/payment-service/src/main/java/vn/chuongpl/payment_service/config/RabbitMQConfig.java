package vn.chuongpl.payment_service.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String PAYMENT_EXCHANGE         = "payment.exchange";
    public static final String PAYMENT_COMPLETED_QUEUE  = "payment.completed.queue";
    public static final String PAYMENT_COMPLETED_KEY    = "payment.completed";
    public static final String PAYMENT_DLQ_EXCHANGE     = "payment.dlq.exchange";
    public static final String PAYMENT_DLQ_QUEUE        = "payment.completed.dlq";
    public static final String PAYMENT_DLQ_ROUTING_KEY  = "payment.completed.dead";

    @Bean
    public DirectExchange paymentExchange() {
        return new DirectExchange(PAYMENT_EXCHANGE);
    }

    @Bean
    public DirectExchange paymentDlqExchange() {
        return new DirectExchange(PAYMENT_DLQ_EXCHANGE);
    }

    @Bean
    public Queue paymentCompletedQueue() {
        return QueueBuilder.durable(PAYMENT_COMPLETED_QUEUE)
                .withArgument("x-dead-letter-exchange", PAYMENT_DLQ_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", PAYMENT_DLQ_ROUTING_KEY)
                .build();
    }

    @Bean
    public Queue paymentDlqQueue() {
        return new Queue(PAYMENT_DLQ_QUEUE, true);
    }

    @Bean
    public Binding paymentCompletedBinding() {
        return BindingBuilder.bind(paymentCompletedQueue()).to(paymentExchange()).with(PAYMENT_COMPLETED_KEY);
    }

    @Bean
    public Binding paymentDlqBinding() {
        return BindingBuilder.bind(paymentDlqQueue()).to(paymentDlqExchange()).with(PAYMENT_DLQ_ROUTING_KEY);
    }

    @Bean
    public MessageConverter messageConverter(ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(objectMapper);
    }

    @Bean
    public AmqpTemplate amqpTemplate(ConnectionFactory connectionFactory, MessageConverter messageConverter) {
        RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        rabbitTemplate.setMessageConverter(messageConverter);
        return rabbitTemplate;
    }
}
