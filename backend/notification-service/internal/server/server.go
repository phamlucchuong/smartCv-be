package server

import (
	"context"
	"log/slog"
	"os"
	"smartCv/notification-service/internal/config"
	"strings"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"smartCv/notification-service/internal/email"
	"smartCv/notification-service/internal/notification"
	"smartCv/notification-service/internal/otp"
	platformEmail "smartCv/notification-service/internal/platform/email"
	"smartCv/notification-service/internal/platform/rabbitmq"
	platformSms "smartCv/notification-service/internal/platform/sms"
	"smartCv/notification-service/internal/sms"

	amqp "github.com/rabbitmq/amqp091-go"
)

type Server struct {
	echo *echo.Echo
	cfg  *config.Config
	log  *slog.Logger
	db   *gorm.DB
	rdb  *redis.Client

	notiSvc notification.ServiceInterface

	rabbitConn *amqp.Connection
	consumer   *notification.Consumer

	notiHandler *notification.Handler
	otpHandler  *otp.Handler
}

func New(cfg *config.Config, log *slog.Logger, gormDB *gorm.DB, rdb *redis.Client) *Server {
	e := echo.New()

	s := &Server{
		echo: e,
		cfg:  cfg,
		log:  log,
		db:   gormDB,
		rdb:  rdb,
	}

	// Initialize RabbitMQ
	rabbitConn, err := rabbitmq.NewRabbitMQConnection(cfg.RabbitMQUser, cfg.RabbitMQPassword, cfg.RabbitMQHost, cfg.RabbitMQPort)
	if err != nil {
		log.Error("failed to connect to rabbitmq", slog.Any("error", err))
	}
	s.rabbitConn = rabbitConn

	// 1. Initialize Platforms/Adapters
	emailProvider := platformEmail.NewService(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUser, cfg.SMTPPassword, cfg.SMTPFrom, cfg.SMTPName)
	if emailProvider == nil {
		log.Warn("email provider not configured; OTP emails will not be sent")
	}

	var smsProvider sms.SMSProvider
	switch resolveSMSProvider(cfg, os.Getenv) {
	case smsProviderTwilio:
		smsProvider = platformSms.NewTwilioProvider(cfg.TwilioAccountSID, cfg.TwilioAuthToken, cfg.TwilioFromNumber)
		log.Info("using Twilio SMS provider")
	case smsProviderSNS:
		smsProvider = platformSms.NewSNSProvider(
			context.Background(),
			cfg.AWSRegion,
			cfg.AWSSNSSenderID,
			cfg.AWSSNSMaxPriceUSD,
			cfg.AWSSNSSMSType,
			cfg.AWSSNSOriginationNumber,
			cfg.AWSSNSEntityID,
			cfg.AWSSNSTemplateID,
		)
		log.Info("using AWS SNS SMS provider")
	default:
		log.Warn("sms provider not configured; OTP SMS messages will not be sent")
	}

	// 2. Initialize Domain Services
	emailSvc := email.NewService(emailProvider)
	smsSvc := sms.NewService(smsProvider)
	otpSvc := otp.NewService(rdb)

	// 3. Initialize Orchestrator
	repo := notification.NewRepository(gormDB)
	s.notiSvc = notification.NewService(
		repo,
		log,
		cfg.FCMProjectID,
		cfg.FCMServiceAccountJSON,
		otpSvc,
		emailSvc,
		smsSvc,
		cfg.AdminEmail,
	)

	s.notiHandler = notification.NewHandler(s.notiSvc, log)
	s.otpHandler = otp.NewHandler(s.notiSvc, log)

	// Initialize RabbitMQ Consumer
	if s.rabbitConn != nil {
		s.consumer = notification.NewConsumer(s.rabbitConn, s.notiSvc, log)
	}

	s.echo.Validator = NewValidator()
	// s.setupMiddleware()
	s.setupRoutes()

	return s
}

const (
	smsProviderSNS    = "aws_sns"
	smsProviderTwilio = "twilio"
)

func resolveSMSProvider(cfg *config.Config, getenv func(string) string) string {
	requested := strings.ToLower(strings.TrimSpace(cfg.SMSProvider))
	hasTwilio := hasTwilioConfig(cfg)
	hasAWSHints := hasAWSAuthHints(getenv)
	hasSNSRegion := strings.TrimSpace(cfg.AWSRegion) != ""

	switch requested {
	case smsProviderTwilio:
		if hasTwilio {
			return smsProviderTwilio
		}
		if hasSNSRegion {
			return smsProviderSNS
		}
		return ""
	case smsProviderSNS:
		if hasSNSRegion && (hasAWSHints || !hasTwilio) {
			return smsProviderSNS
		}
		if hasTwilio {
			return smsProviderTwilio
		}
		if hasSNSRegion {
			return smsProviderSNS
		}
		return ""
	default:
		if hasTwilio {
			return smsProviderTwilio
		}
		if hasSNSRegion {
			return smsProviderSNS
		}
		return ""
	}
}

func hasTwilioConfig(cfg *config.Config) bool {
	return strings.TrimSpace(cfg.TwilioAccountSID) != "" &&
		strings.TrimSpace(cfg.TwilioAuthToken) != "" &&
		strings.TrimSpace(cfg.TwilioFromNumber) != ""
}

func hasAWSAuthHints(getenv func(string) string) bool {
	keys := []string{
		"AWS_ACCESS_KEY_ID",
		"AWS_PROFILE",
		"AWS_WEB_IDENTITY_TOKEN_FILE",
		"AWS_CONTAINER_CREDENTIALS_RELATIVE_URI",
		"AWS_CONTAINER_CREDENTIALS_FULL_URI",
		"AWS_SHARED_CREDENTIALS_FILE",
		"AWS_CONFIG_FILE",
	}

	for _, key := range keys {
		if strings.TrimSpace(getenv(key)) != "" {
			return true
		}
	}

	return false
}

// Start runs the HTTP server and blocks until ctx is cancelled, then shuts down gracefully.
func (s *Server) Start(ctx context.Context) error {
	s.log.Info("server starting", slog.String("port", s.cfg.Port))

	go func() {
		<-ctx.Done()
		if s.rabbitConn != nil {
			s.rabbitConn.Close()
		}
	}()

	// Start RabbitMQ Consumer
	if s.consumer != nil {
		go func() {
			if err := s.consumer.Listen(); err != nil {
				s.log.Error("failed to start rabbitmq OTP consumer", slog.Any("error", err))
			}
		}()

		go func() {
			if err := s.consumer.ListenApplicationEvents(); err != nil {
				s.log.Error("failed to start application event consumer", slog.Any("error", err))
			}
		}()

		go func() {
			if err := s.consumer.ListenRecruiterEvents(); err != nil {
				s.log.Error("failed to start recruiter event consumer", slog.Any("error", err))
			}
		}()

		go func() {
			if err := s.consumer.ListenJobModerationEvents(); err != nil {
				s.log.Error("failed to start job moderation event consumer", slog.Any("error", err))
			}
		}()

		go func() {
			if err := s.consumer.ListenCvAnalysisEvents(); err != nil {
				s.log.Error("failed to start cv analysis event consumer", slog.Any("error", err))
			}
		}()

		go func() {
			if err := s.consumer.ListenApplicationSubmittedEvents(); err != nil {
				s.log.Error("failed to start application submitted event consumer", slog.Any("error", err))
			}
		}()

		go func() {
			if err := s.consumer.ListenRecruiterPendingEvents(); err != nil {
				s.log.Error("failed to start recruiter pending event consumer", slog.Any("error", err))
			}
		}()

		go func() {
			if err := s.consumer.ListenRecruiterBillingEvents(); err != nil {
				s.log.Error("failed to start recruiter billing event consumer", slog.Any("error", err))
			}
		}()

		go func() {
			if err := s.consumer.ListenAssessmentEvents(); err != nil {
				s.log.Error("failed to start assessment event consumer", slog.Any("error", err))
			}
		}()

		go func() {
			if err := s.consumer.ListenPackageExpiredEvents(); err != nil {
				s.log.Error("failed to start package expired event consumer", slog.Any("error", err))
			}
		}()

		go func() {
			if err := s.consumer.ListenPackageExpiringSoonEvents(); err != nil {
				s.log.Error("failed to start package expiring soon event consumer", slog.Any("error", err))
			}
		}()

		go func() {
			if err := s.consumer.ListenAiCreditExhaustedEvents(); err != nil {
				s.log.Error("failed to start AI credit exhausted event consumer", slog.Any("error", err))
			}
		}()
	}

	sc := echo.StartConfig{
		Address:         ":" + s.cfg.Port,
		GracefulTimeout: 10 * time.Second,
		HideBanner:      true,
	}

	return sc.Start(ctx, s.echo)
}
