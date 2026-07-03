package notification

import (
	"context"
	"encoding/json"
	"log/slog"
	"smartCv/notification-service/internal/otp"

	amqp "github.com/rabbitmq/amqp091-go"
)

type Consumer struct {
	conn    *amqp.Connection
	notiSvc ServiceInterface
	logger  *slog.Logger
}

func NewConsumer(conn *amqp.Connection, notiSvc ServiceInterface, logger *slog.Logger) *Consumer {
	return &Consumer{
		conn:    conn,
		notiSvc: notiSvc,
		logger:  logger,
	}
}

type OTPMessage struct {
	Target     string `json:"target"`
	TargetType string `json:"targetType"`
	OtpType    string `json:"otpType"`
	TTLMinutes int    `json:"ttlMinutes"`
}

type ApplicationEventMessage struct {
	ApplicationID   string `json:"applicationId"`
	CandidateID     string `json:"candidateId"`
	CandidateEmail  string `json:"candidateEmail"`
	RecruiterID     string `json:"recruiterId"`
	RecruiterUserID string `json:"recruiterUserId"`
	JobID           string `json:"jobId"`
	JobTitle        string `json:"jobTitle"`
	NewStatus       string `json:"newStatus"`
	RejectionReason string `json:"rejectionReason,omitempty"`
	OccurredAt      string `json:"occurredAt"`
}

type RecruiterStatusEventMessage struct {
	RecruiterID    string `json:"recruiterId"`
	RecruiterEmail string `json:"recruiterEmail"`
	ContactEmail   string `json:"contactEmail"`
	CompanyName    string `json:"companyName"`
	Status         string `json:"status"`
	RejectionNote  string `json:"rejectionNote,omitempty"`
}

type JobModerationEventMessage struct {
	JobID          string `json:"jobId"`
	RecruiterID    string `json:"recruiterId"`
	RecruiterEmail string `json:"recruiterEmail"`
	Title          string `json:"title"`
	Company        string `json:"company"`
	EventType      string `json:"eventType"`
	ModerationNote string `json:"moderationNote,omitempty"`
}

type CvAnalysisDoneMessage struct {
	UserID   string `json:"userId"`
	CvID     string `json:"cvId"`
	Filename string `json:"filename"`
}

type RecruiterPendingEventMessage struct {
	RecruiterID    string   `json:"recruiterId"`
	RecruiterEmail string   `json:"recruiterEmail"`
	CompanyName    string   `json:"companyName"`
	AdminUserIDs   []string `json:"adminUserIds"`
	OccurredAt     string   `json:"occurredAt"`
}

type RecruiterBillingEventMessage struct {
	RecruiterID    string `json:"recruiterId"`
	RecruiterUserID string `json:"recruiterUserId"`
	RecruiterEmail string `json:"recruiterEmail"`
	CompanyName    string `json:"companyName"`
	EventType      string `json:"eventType"`
	DueAt          string `json:"dueAt"`
	LockedAt       string `json:"lockedAt,omitempty"`
	Amount         string `json:"amount"`
}

type PackageExpiredEventMessage struct {
	UserID    string `json:"userId"`
	UserEmail string `json:"userEmail"`
	UserRole  string `json:"userRole"`
	PackageID string `json:"packageId"`
	ExpiredAt string `json:"expiredAt"`
}

type PackageExpiringSoonMessage struct {
	UserID    string `json:"userId"`
	UserEmail string `json:"userEmail"`
	UserRole  string `json:"userRole"`
	PackageID string `json:"packageId"`
	ExpiresAt string `json:"expiresAt"`
}

type AiCreditExhaustedMessage struct {
	UserID   string `json:"userId"`
	UserRole string `json:"userRole"`
}


type AssessmentEventMessage struct {
	AttemptID       string  `json:"attemptId"`
	AssessmentID    string  `json:"assessmentId"`
	AssessmentTitle string  `json:"assessmentTitle"`
	CandidateID     string  `json:"candidateId"`
	RecruiterID     string  `json:"recruiterId"`
	RecruiterUserID string  `json:"recruiterUserId"`
	Score           float64 `json:"score"`
	Result          string  `json:"result"`
	Overtime        bool    `json:"overtime"`
	OccurredAt      string  `json:"occurredAt"`
}

func (c *Consumer) ListenAssessmentEvents() error {
	ch, err := c.conn.Channel()
	if err != nil {
		return err
	}

	if err = ch.ExchangeDeclare("assessment.exchange", "direct", true, false, false, false, nil); err != nil {
		return err
	}

	queue, err := ch.QueueDeclare("assessment.submitted.queue", true, false, false, false, nil)
	if err != nil {
		return err
	}

	if err = ch.QueueBind(queue.Name, "assessment.submitted", "assessment.exchange", false, nil); err != nil {
		return err
	}

	msgs, err := ch.Consume(queue.Name, "", true, false, false, false, nil)
	if err != nil {
		return err
	}

	go func() {
		for d := range msgs {
			var msg AssessmentEventMessage
			if err := json.Unmarshal(d.Body, &msg); err != nil {
				c.logger.Error("failed to unmarshal assessment event", "error", err)
				continue
			}
			c.logger.Info("received assessment submitted event", "attemptId", msg.AttemptID, "candidateId", msg.CandidateID)
			if err := c.notiSvc.HandleAssessmentSubmitted(context.Background(), msg); err != nil {
				c.logger.Error("failed to handle assessment submitted event", "attemptId", msg.AttemptID, "error", err)
			}
		}
	}()

	c.logger.Info("RabbitMQ consumer listening on assessment.submitted.queue")
	return nil
}

func (c *Consumer) ListenCvAnalysisEvents() error {
	ch, err := c.conn.Channel()
	if err != nil {
		return err
	}

	if err = ch.ExchangeDeclare("cv.analysis.exchange", "direct", true, false, false, false, nil); err != nil {
		return err
	}

	queue, err := ch.QueueDeclare("cv.analysis.done.queue", true, false, false, false, nil)
	if err != nil {
		return err
	}
	if err = ch.QueueBind(queue.Name, "cv.analysis.done", "cv.analysis.exchange", false, nil); err != nil {
		return err
	}

	msgs, err := ch.Consume(queue.Name, "", true, false, false, false, nil)
	if err != nil {
		return err
	}

	go func() {
		for d := range msgs {
			var msg CvAnalysisDoneMessage
			if err := json.Unmarshal(d.Body, &msg); err != nil {
				c.logger.Error("failed to unmarshal cv analysis done event", "error", err)
				continue
			}
			c.logger.Info("processing cv analysis done event", "userId", msg.UserID, "cvId", msg.CvID)
			c.notiSvc.NotifyCvAnalysisDone(context.Background(), msg.UserID, msg.Filename)
		}
	}()

	c.logger.Info("RabbitMQ consumer listening on cv.analysis.done.queue")
	return nil
}

func (c *Consumer) Listen() error {
	ch, err := c.conn.Channel()
	if err != nil {
		return err
	}

	err = ch.ExchangeDeclare(
		"notification.exchange",
		"direct",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return err
	}

	q, err := ch.QueueDeclare(
		"otp.queue",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return err
	}

	err = ch.QueueBind(
		q.Name,
		"otp.routing.key",
		"notification.exchange",
		false,
		nil,
	)
	if err != nil {
		return err
	}

	msgs, err := ch.Consume(
		q.Name,
		"",
		true,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return err
	}

	go func() {
		for d := range msgs {
			var msg OTPMessage
			if err := json.Unmarshal(d.Body, &msg); err != nil {
				c.logger.Error("failed to unmarshal otp message", "error", err)
				continue
			}

			c.logger.Info("received otp message from rabbitmq", "target", msg.Target, "type", msg.TargetType, "otpType", msg.OtpType)

			ttl := msg.TTLMinutes
			if ttl == 0 {
				ttl = otp.DefaultTTLMinutes
			}

			err := c.notiSvc.SendOTP(context.Background(), msg.Target, msg.TargetType, msg.OtpType, ttl)
			if err != nil {
				c.logger.Error("failed to send otp from consumer", "error", err)
			}
		}
	}()

	c.logger.Info("RabbitMQ consumer is listening on otp.queue")
	return nil
}

func (c *Consumer) ListenApplicationEvents() error {
	ch, err := c.conn.Channel()
	if err != nil {
		return err
	}

	err = ch.ExchangeDeclare("application.exchange", "direct", true, false, false, false, nil)
	if err != nil {
		return err
	}

	queues := []struct {
		name       string
		routingKey string
	}{
		{"application.accepted.queue", "application.accepted"},
		{"application.rejected.queue", "application.rejected"},
		{"application.withdrawn.queue", "application.withdrawn"},
	}

	var allMsgs []<-chan amqp.Delivery
	for _, q := range queues {
		queue, err := ch.QueueDeclare(q.name, true, false, false, false, nil)
		if err != nil {
			return err
		}
		if err = ch.QueueBind(queue.Name, q.routingKey, "application.exchange", false, nil); err != nil {
			return err
		}
		msgs, err := ch.Consume(queue.Name, "", true, false, false, false, nil)
		if err != nil {
			return err
		}
		allMsgs = append(allMsgs, msgs)
	}

	for _, msgs := range allMsgs {
		go func(deliveries <-chan amqp.Delivery) {
			for d := range deliveries {
				var msg ApplicationEventMessage
				if err := json.Unmarshal(d.Body, &msg); err != nil {
					c.logger.Error("failed to unmarshal application event", "error", err)
					continue
				}
				c.handleApplicationEvent(msg)
			}
		}(msgs)
	}

	c.logger.Info("RabbitMQ consumer listening on application event queues")
	return nil
}

func (c *Consumer) handleApplicationEvent(msg ApplicationEventMessage) {
	if msg.CandidateEmail == "" {
		c.logger.Warn("application event missing candidateEmail, skipping", "applicationId", msg.ApplicationID)
		return
	}

	c.logger.Info("processing application event", "applicationId", msg.ApplicationID, "status", msg.NewStatus)

	ctx := context.Background()
	if err := c.notiSvc.SendApplicationResultEmail(ctx, msg); err != nil {
		c.logger.Error("failed to send application result email", "applicationId", msg.ApplicationID, "error", err)
	}

	title, body := applicationPushContent(msg.NewStatus, msg.JobTitle, msg.RejectionReason)
	data := map[string]string{
		"applicationId": msg.ApplicationID,
		"jobId":         msg.JobID,
		"jobTitle":      msg.JobTitle,
		"status":        msg.NewStatus,
		"url":           "/applications",
	}
	c.notiSvc.NotifyApplicationStatusChanged(ctx, msg.CandidateID, title, body, data)
}

func applicationPushContent(status, jobTitle, rejectionReason string) (title, body string) {
	switch status {
	case "ACCEPTED":
		title = "Application Accepted 🎉"
		body = "Your application for \"" + jobTitle + "\" has been accepted!"
	case "REJECTED":
		title = "Application Update"
		body = "Your application for \"" + jobTitle + "\" was not selected."
		if rejectionReason != "" {
			body += " Reason: " + rejectionReason
		}
	default:
		title = "Application Status Changed"
		body = "Your application for \"" + jobTitle + "\" is now " + status + "."
	}
	return
}

func (c *Consumer) ListenRecruiterEvents() error {
	ch, err := c.conn.Channel()
	if err != nil {
		return err
	}

	if err = ch.ExchangeDeclare("recruiter.notification.exchange", "direct", true, false, false, false, nil); err != nil {
		return err
	}

	queues := []struct {
		name       string
		routingKey string
	}{
		{"recruiter.approved.queue", "recruiter.approved"},
		{"recruiter.rejected.queue", "recruiter.rejected"},
	}

	var allMsgs []<-chan amqp.Delivery
	for _, q := range queues {
		queue, err := ch.QueueDeclare(q.name, true, false, false, false, nil)
		if err != nil {
			return err
		}
		if err = ch.QueueBind(queue.Name, q.routingKey, "recruiter.notification.exchange", false, nil); err != nil {
			return err
		}
		msgs, err := ch.Consume(queue.Name, "", true, false, false, false, nil)
		if err != nil {
			return err
		}
		allMsgs = append(allMsgs, msgs)
	}

	for _, msgs := range allMsgs {
		go func(deliveries <-chan amqp.Delivery) {
			for d := range deliveries {
				var msg RecruiterStatusEventMessage
				if err := json.Unmarshal(d.Body, &msg); err != nil {
					c.logger.Error("failed to unmarshal recruiter status event", "error", err)
					continue
				}
				c.handleRecruiterStatusEvent(msg)
			}
		}(msgs)
	}

	c.logger.Info("RabbitMQ consumer listening on recruiter event queues")
	return nil
}

func (c *Consumer) handleRecruiterStatusEvent(msg RecruiterStatusEventMessage) {
	c.logger.Info("processing recruiter status event", "recruiterId", msg.RecruiterID, "status", msg.Status)
	ctx := context.Background()
	var err error
	if msg.Status == "APPROVED" {
		err = c.notiSvc.HandleRecruiterApproved(ctx, msg)
	} else {
		err = c.notiSvc.HandleRecruiterRejected(ctx, msg)
	}
	if err != nil {
		c.logger.Error("failed to handle recruiter status event", "recruiterId", msg.RecruiterID, "status", msg.Status, "error", err)
	}
}

func (c *Consumer) ListenJobModerationEvents() error {
	ch, err := c.conn.Channel()
	if err != nil {
		return err
	}

	if err = ch.ExchangeDeclare("job.exchange", "direct", true, false, false, false, nil); err != nil {
		return err
	}

	queues := []struct {
		name       string
		routingKey string
	}{
		{"job.approved.queue", "job.approved"},
		{"job.rejected.queue", "job.rejected"},
	}

	var allMsgs []<-chan amqp.Delivery
	for _, q := range queues {
		queue, err := ch.QueueDeclare(q.name, true, false, false, false, nil)
		if err != nil {
			return err
		}
		if err = ch.QueueBind(queue.Name, q.routingKey, "job.exchange", false, nil); err != nil {
			return err
		}
		msgs, err := ch.Consume(queue.Name, "", true, false, false, false, nil)
		if err != nil {
			return err
		}
		allMsgs = append(allMsgs, msgs)
	}

	for _, msgs := range allMsgs {
		go func(deliveries <-chan amqp.Delivery) {
			for d := range deliveries {
				var msg JobModerationEventMessage
				if err := json.Unmarshal(d.Body, &msg); err != nil {
					c.logger.Error("failed to unmarshal job moderation event", "error", err)
					continue
				}
				c.handleJobModerationEvent(msg)
			}
		}(msgs)
	}

	c.logger.Info("RabbitMQ consumer listening on job moderation event queues")
	return nil
}

func (c *Consumer) handleJobModerationEvent(msg JobModerationEventMessage) {
	c.logger.Info("processing job moderation event", "jobId", msg.JobID, "eventType", msg.EventType)
	ctx := context.Background()
	var err error
	if msg.EventType == "APPROVED" {
		err = c.notiSvc.HandleJobApproved(ctx, msg)
	} else {
		err = c.notiSvc.HandleJobRejected(ctx, msg)
	}
	if err != nil {
		c.logger.Error("failed to handle job moderation event", "jobId", msg.JobID, "eventType", msg.EventType, "error", err)
	}
}

func (c *Consumer) ListenApplicationSubmittedEvents() error {
	ch, err := c.conn.Channel()
	if err != nil {
		return err
	}

	if err = ch.ExchangeDeclare("application.exchange", "direct", true, false, false, false, nil); err != nil {
		return err
	}

	queue, err := ch.QueueDeclare("application.submitted.queue", true, false, false, false, nil)
	if err != nil {
		return err
	}

	if err = ch.QueueBind(queue.Name, "application.submitted", "application.exchange", false, nil); err != nil {
		return err
	}

	msgs, err := ch.Consume(queue.Name, "", true, false, false, false, nil)
	if err != nil {
		return err
	}

	go func() {
		for d := range msgs {
			var msg ApplicationEventMessage
			if err := json.Unmarshal(d.Body, &msg); err != nil {
				c.logger.Error("failed to unmarshal application submitted event", "error", err)
				continue
			}
			c.logger.Info("received application submitted event", "applicationId", msg.ApplicationID, "recruiterId", msg.RecruiterID, "recruiterUserId", msg.RecruiterUserID)
			c.notiSvc.NotifyNewApplicant(context.Background(), msg.RecruiterID, msg.RecruiterUserID, msg.ApplicationID, msg.JobTitle, msg.JobID)
		}
	}()

	c.logger.Info("RabbitMQ consumer listening on application.submitted.queue")
	return nil
}

func (c *Consumer) ListenRecruiterPendingEvents() error {
	ch, err := c.conn.Channel()
	if err != nil {
		return err
	}

	if err = ch.ExchangeDeclare("recruiter.notification.exchange", "direct", true, false, false, false, nil); err != nil {
		return err
	}

	queue, err := ch.QueueDeclare("recruiter.pending.queue", true, false, false, false, nil)
	if err != nil {
		return err
	}

	if err = ch.QueueBind(queue.Name, "recruiter.pending", "recruiter.notification.exchange", false, nil); err != nil {
		return err
	}

	msgs, err := ch.Consume(queue.Name, "", true, false, false, false, nil)
	if err != nil {
		return err
	}

	go func() {
		for d := range msgs {
			var msg RecruiterPendingEventMessage
			if err := json.Unmarshal(d.Body, &msg); err != nil {
				c.logger.Error("failed to unmarshal recruiter pending event", "error", err)
				continue
			}
			c.logger.Info("received recruiter pending event", "recruiterId", msg.RecruiterID, "company", msg.CompanyName)
			c.notiSvc.NotifyAdminNewRecruiterRequest(context.Background(), msg)
		}
	}()

	c.logger.Info("RabbitMQ consumer listening on recruiter.pending.queue")
	return nil
}

func (c *Consumer) ListenRecruiterBillingEvents() error {
	ch, err := c.conn.Channel()
	if err != nil {
		return err
	}

	if err = ch.ExchangeDeclare("recruiter.notification.exchange", "direct", true, false, false, false, nil); err != nil {
		return err
	}

	queue, err := ch.QueueDeclare("recruiter.billing.queue", true, false, false, false, nil)
	if err != nil {
		return err
	}

	if err = ch.QueueBind(queue.Name, "recruiter.billing", "recruiter.notification.exchange", false, nil); err != nil {
		return err
	}

	msgs, err := ch.Consume(queue.Name, "", true, false, false, false, nil)
	if err != nil {
		return err
	}

	go func() {
		for d := range msgs {
			var msg RecruiterBillingEventMessage
			if err := json.Unmarshal(d.Body, &msg); err != nil {
				c.logger.Error("failed to unmarshal recruiter billing event", "error", err)
				continue
			}
			c.logger.Info("received recruiter billing event", "recruiterId", msg.RecruiterID, "eventType", msg.EventType)
			if err := c.notiSvc.HandleRecruiterBillingNotice(context.Background(), msg); err != nil {
				c.logger.Error("failed to handle recruiter billing event", "recruiterId", msg.RecruiterID, "error", err)
			}
		}
	}()

	c.logger.Info("RabbitMQ consumer listening on recruiter.billing.queue")
	return nil
}

func (c *Consumer) ListenPackageExpiredEvents() error {
	ch, err := c.conn.Channel()
	if err != nil {
		return err
	}

	if err = ch.ExchangeDeclare("recruiter.notification.exchange", "direct", true, false, false, false, nil); err != nil {
		return err
	}

	queue, err := ch.QueueDeclare("package.expired.queue", true, false, false, false, nil)
	if err != nil {
		return err
	}

	if err = ch.QueueBind(queue.Name, "package.expired", "recruiter.notification.exchange", false, nil); err != nil {
		return err
	}

	msgs, err := ch.Consume(queue.Name, "", true, false, false, false, nil)
	if err != nil {
		return err
	}

	go func() {
		for d := range msgs {
			var msg PackageExpiredEventMessage
			if err := json.Unmarshal(d.Body, &msg); err != nil {
				c.logger.Error("failed to unmarshal package expired event", "error", err)
				continue
			}
			c.logger.Info("received package expired event", "userId", msg.UserID, "role", msg.UserRole)
			if err := c.notiSvc.HandlePackageExpiredNotice(context.Background(), msg); err != nil {
				c.logger.Error("failed to handle package expired event", "userId", msg.UserID, "error", err)
			}
		}
	}()

	c.logger.Info("RabbitMQ consumer listening on package.expired.queue")
	return nil
}

func (c *Consumer) ListenPackageExpiringSoonEvents() error {
	ch, err := c.conn.Channel()
	if err != nil {
		return err
	}

	if err = ch.ExchangeDeclare("recruiter.notification.exchange", "direct", true, false, false, false, nil); err != nil {
		return err
	}

	queue, err := ch.QueueDeclare("package.expiring.soon.queue", true, false, false, false, nil)
	if err != nil {
		return err
	}

	if err = ch.QueueBind(queue.Name, "package.expiring.soon", "recruiter.notification.exchange", false, nil); err != nil {
		return err
	}

	msgs, err := ch.Consume(queue.Name, "", true, false, false, false, nil)
	if err != nil {
		return err
	}

	go func() {
		for d := range msgs {
			var msg PackageExpiringSoonMessage
			if err := json.Unmarshal(d.Body, &msg); err != nil {
				c.logger.Error("failed to unmarshal package expiring soon event", "error", err)
				continue
			}
			c.logger.Info("received package expiring soon event", "userId", msg.UserID, "role", msg.UserRole)
			if err := c.notiSvc.HandlePackageExpiringSoonNotice(context.Background(), msg); err != nil {
				c.logger.Error("failed to handle package expiring soon event", "userId", msg.UserID, "error", err)
			}
		}
	}()

	c.logger.Info("RabbitMQ consumer listening on package.expiring.soon.queue")
	return nil
}

func (c *Consumer) ListenAiCreditExhaustedEvents() error {
	ch, err := c.conn.Channel()
	if err != nil {
		return err
	}

	if err = ch.ExchangeDeclare("recruiter.notification.exchange", "direct", true, false, false, false, nil); err != nil {
		return err
	}

	queue, err := ch.QueueDeclare("ai.credit.exhausted.queue", true, false, false, false, nil)
	if err != nil {
		return err
	}

	if err = ch.QueueBind(queue.Name, "ai.credit.exhausted", "recruiter.notification.exchange", false, nil); err != nil {
		return err
	}

	msgs, err := ch.Consume(queue.Name, "", true, false, false, false, nil)
	if err != nil {
		return err
	}

	go func() {
		for d := range msgs {
			var msg AiCreditExhaustedMessage
			if err := json.Unmarshal(d.Body, &msg); err != nil {
				c.logger.Error("failed to unmarshal AI credit exhausted event", "error", err)
				continue
			}
			c.logger.Info("received AI credit exhausted event", "userId", msg.UserID, "role", msg.UserRole)
			if err := c.notiSvc.HandleAiCreditExhaustedNotice(context.Background(), msg); err != nil {
				c.logger.Error("failed to handle AI credit exhausted event", "userId", msg.UserID, "error", err)
			}
		}
	}()

	c.logger.Info("RabbitMQ consumer listening on ai.credit.exhausted.queue")
	return nil
}

