package vn.chuongpl.user_service.configuration;
 
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
 
@Configuration
public class RabbitMQConfig {
 
    public static final String EXCHANGE = "notification.exchange";
    public static final String QUEUE = "otp.queue";
    public static final String ROUTING_KEY = "otp.routing.key";
    public static final String SKILL_EXCHANGE = "candidate.skill.exchange";
    public static final String SKILL_EXTRACT_QUEUE = "candidate.skill.extract.queue";
    public static final String SKILL_ROUTING_KEY = "candidate.skill.extract";
 
    @Bean
    public Queue otpQueue() {
        return new Queue(QUEUE);
    }
 
    @Bean
    public DirectExchange exchange() {
        return new DirectExchange(EXCHANGE);
    }
 
    @Bean
    public Binding binding() {
        return BindingBuilder.bind(otpQueue()).to(exchange()).with(ROUTING_KEY);
    }

    @Bean
    public Queue skillExtractQueue() {
        return new Queue(SKILL_EXTRACT_QUEUE, true);
    }

    @Bean
    public DirectExchange skillExchange() {
        return new DirectExchange(SKILL_EXCHANGE);
    }

    @Bean
    public Binding skillBinding() {
        return BindingBuilder.bind(skillExtractQueue()).to(skillExchange()).with(SKILL_ROUTING_KEY);
    }
 
    public static final String JOB_SUGGESTIONS_QUEUE = "job.suggestions.queue";
    public static final String JOB_SUGGESTIONS_EXCHANGE = "job.suggestions.exchange";
    public static final String JOB_SUGGESTIONS_ROUTING_KEY = "job.suggestions";
    public static final String JOB_SUGGESTIONS_DLQ_EXCHANGE = "job.suggestions.dlq.exchange";
    public static final String JOB_SUGGESTIONS_DLQ_QUEUE = "job.suggestions.dlq";
    public static final String JOB_SUGGESTIONS_DLQ_ROUTING_KEY = "job.suggestions.dead";

    public static final String RECRUITER_EXCHANGE = "recruiter.notification.exchange";
    public static final String RECRUITER_APPROVED_QUEUE = "recruiter.approved.queue";
    public static final String RECRUITER_REJECTED_QUEUE = "recruiter.rejected.queue";
    public static final String RECRUITER_APPROVED_KEY = "recruiter.approved";
    public static final String RECRUITER_REJECTED_KEY = "recruiter.rejected";
    public static final String RECRUITER_PENDING_QUEUE = "recruiter.pending.queue";
    public static final String RECRUITER_PENDING_KEY = "recruiter.pending";
    public static final String RECRUITER_BILLING_KEY = "recruiter.billing";
    public static final String RECRUITER_BILLING_QUEUE = "recruiter.billing.queue";
    public static final String PACKAGE_EXPIRED_QUEUE = "package.expired.queue";
    public static final String PACKAGE_EXPIRED_KEY = "package.expired";
    public static final String PACKAGE_EXPIRING_SOON_QUEUE = "package.expiring.soon.queue";
    public static final String PACKAGE_EXPIRING_SOON_KEY = "package.expiring.soon";
    public static final String AI_CREDIT_EXHAUSTED_QUEUE = "ai.credit.exhausted.queue";
    public static final String AI_CREDIT_EXHAUSTED_KEY = "ai.credit.exhausted";


    @Bean
    public Queue jobSuggestionsQueue() {
        return QueueBuilder.durable(JOB_SUGGESTIONS_QUEUE)
                .withArgument("x-dead-letter-exchange", JOB_SUGGESTIONS_DLQ_EXCHANGE)
                .withArgument("x-dead-letter-routing-key", JOB_SUGGESTIONS_DLQ_ROUTING_KEY)
                .build();
    }

    @Bean
    public DirectExchange jobSuggestionsExchange() {
        return new DirectExchange(JOB_SUGGESTIONS_EXCHANGE);
    }

    @Bean
    public DirectExchange jobSuggestionsDlqExchange() {
        return new DirectExchange(JOB_SUGGESTIONS_DLQ_EXCHANGE);
    }

    @Bean
    public Queue jobSuggestionsDlqQueue() {
        return new Queue(JOB_SUGGESTIONS_DLQ_QUEUE, true);
    }

    @Bean
    public Binding jobSuggestionsBinding() {
        return BindingBuilder.bind(jobSuggestionsQueue()).to(jobSuggestionsExchange()).with(JOB_SUGGESTIONS_ROUTING_KEY);
    }

    @Bean
    public Binding jobSuggestionsDlqBinding() {
        return BindingBuilder.bind(jobSuggestionsDlqQueue())
                .to(jobSuggestionsDlqExchange())
                .with(JOB_SUGGESTIONS_DLQ_ROUTING_KEY);
    }

    @Bean
    public DirectExchange recruiterExchange() {
        return new DirectExchange(RECRUITER_EXCHANGE);
    }

    @Bean
    public Queue recruiterApprovedQueue() {
        return new Queue(RECRUITER_APPROVED_QUEUE, true);
    }

    @Bean
    public Queue recruiterRejectedQueue() {
        return new Queue(RECRUITER_REJECTED_QUEUE, true);
    }

    @Bean
    public Queue recruiterPendingQueue() {
        return new Queue(RECRUITER_PENDING_QUEUE, true);
    }

    @Bean
    public Binding recruiterApprovedBinding() {
        return BindingBuilder.bind(recruiterApprovedQueue()).to(recruiterExchange()).with(RECRUITER_APPROVED_KEY);
    }

    @Bean
    public Binding recruiterRejectedBinding() {
        return BindingBuilder.bind(recruiterRejectedQueue()).to(recruiterExchange()).with(RECRUITER_REJECTED_KEY);
    }

    @Bean
    public Binding recruiterPendingBinding() {
        return BindingBuilder.bind(recruiterPendingQueue()).to(recruiterExchange()).with(RECRUITER_PENDING_KEY);
    }

    @Bean
    public Queue recruiterBillingQueue() {
        return new Queue(RECRUITER_BILLING_QUEUE, true);
    }

    @Bean
    public Binding recruiterBillingBinding() {
        return BindingBuilder.bind(recruiterBillingQueue()).to(recruiterExchange()).with(RECRUITER_BILLING_KEY);
    }

    @Bean
    public Queue packageExpiredQueue() {
        return new Queue(PACKAGE_EXPIRED_QUEUE, true);
    }

    @Bean
    public Binding packageExpiredBinding() {
        return BindingBuilder.bind(packageExpiredQueue()).to(recruiterExchange()).with(PACKAGE_EXPIRED_KEY);
    }

    @Bean
    public Queue packageExpiringSoonQueue() {
        return new Queue(PACKAGE_EXPIRING_SOON_QUEUE, true);
    }

    @Bean
    public Binding packageExpiringSoonBinding() {
        return BindingBuilder.bind(packageExpiringSoonQueue()).to(recruiterExchange()).with(PACKAGE_EXPIRING_SOON_KEY);
    }

    @Bean
    public Queue aiCreditExhaustedQueue() {
        return new Queue(AI_CREDIT_EXHAUSTED_QUEUE, true);
    }

    @Bean
    public Binding aiCreditExhaustedBinding() {
        return BindingBuilder.bind(aiCreditExhaustedQueue()).to(recruiterExchange()).with(AI_CREDIT_EXHAUSTED_KEY);
    }


    public static final String CV_ANALYSIS_EXCHANGE = "cv.analysis.exchange";
    public static final String CV_ANALYSIS_DONE_QUEUE = "cv.analysis.done.queue";
    public static final String CV_ANALYSIS_DONE_KEY = "cv.analysis.done";

    @Bean
    public DirectExchange cvAnalysisExchange() {
        return new DirectExchange(CV_ANALYSIS_EXCHANGE);
    }

    @Bean
    public Queue cvAnalysisDoneQueue() {
        return new Queue(CV_ANALYSIS_DONE_QUEUE, true);
    }

    @Bean
    public Binding cvAnalysisDoneBinding() {
        return BindingBuilder.bind(cvAnalysisDoneQueue()).to(cvAnalysisExchange()).with(CV_ANALYSIS_DONE_KEY);
    }

    public static final String PAYMENT_EXCHANGE        = "payment.exchange";
    public static final String PAYMENT_COMPLETED_QUEUE = "payment.completed.queue";
    public static final String PAYMENT_COMPLETED_KEY   = "payment.completed";
    public static final String PAYMENT_DLQ_EXCHANGE    = "payment.dlq.exchange";
    public static final String PAYMENT_DLQ_QUEUE       = "payment.completed.dlq";
    public static final String PAYMENT_DLQ_ROUTING_KEY = "payment.completed.dead";

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
        return org.springframework.amqp.core.QueueBuilder.durable(PAYMENT_COMPLETED_QUEUE)
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
    public MessageConverter converter(com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(objectMapper);
    }

    @Bean
    public AmqpTemplate amqpTemplate(ConnectionFactory connectionFactory, com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
        final RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        rabbitTemplate.setMessageConverter(converter(objectMapper));
        return rabbitTemplate;
    }
}
