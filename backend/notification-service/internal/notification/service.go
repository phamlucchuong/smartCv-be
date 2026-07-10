package notification

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"sync"
	"time"

	"smartCv/notification-service/internal/email"
	"smartCv/notification-service/internal/otp"
	"smartCv/notification-service/internal/sms"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"firebase.google.com/go/v4/messaging"
	"github.com/google/uuid"
	"google.golang.org/api/option"
	"gorm.io/datatypes"
)

type ServiceInterface interface {
	NotifyNewOrder(ctx context.Context, userID string, vendorID string, orderNo string, totalAmount int)
	NotifyOrderPlaced(ctx context.Context, userID string, orderID string, orderNo string, totalAmount int)
	NotifyOrderStatusUpdated(ctx context.Context, userID string, orderID string, subOrderID string, orderNo string, status string, trackingCode *string, shippingProvider *string)
	SubscribeFCMToken(ctx context.Context, userID string, token string, audience string) error
	UnsubscribeFCMToken(ctx context.Context, userID string, token string, audience string) error

	// Persistent notification methods
	CreateNotification(ctx context.Context, receiverID string, receiverType string, title string, body string, notifType string, data datatypes.JSON) error
	GetNotificationsHistory(ctx context.Context, userID string, receiverType string, page, pageSize int) ([]Notification, int64, error)
	MarkAsRead(ctx context.Context, notificationID string) error
	MarkAsReadForUser(ctx context.Context, notificationID string, userID string) error
	MarkAllAsRead(ctx context.Context, receiverID string, receiverType string) error
	GetUnreadCount(ctx context.Context, receiverID string, receiverType string) (int64, error)
	CleanupOldNotifications(ctx context.Context, olderThanDays int) (int64, error)
	GenerateFirebaseToken(ctx context.Context, userID string) (string, error)
	DeleteNotificationForUser(ctx context.Context, notificationID string, userID string) error

	// OTP methods
	SendOTP(ctx context.Context, target string, targetType string, otpType string, ttlMinutes int) error
	VerifyOTP(ctx context.Context, target string, targetType string, otpType string, code string) (bool, error)
	SendApplicationResultEmail(ctx context.Context, msg ApplicationEventMessage) error

	// Recruiter & job approval notifications
	HandleRecruiterApproved(ctx context.Context, msg RecruiterStatusEventMessage) error
	HandleRecruiterRejected(ctx context.Context, msg RecruiterStatusEventMessage) error
	HandleRecruiterBillingNotice(ctx context.Context, msg RecruiterBillingEventMessage) error
	HandlePackageExpiredNotice(ctx context.Context, msg PackageExpiredEventMessage) error
	HandlePackageExpiringSoonNotice(ctx context.Context, msg PackageExpiringSoonMessage) error
	HandleAiCreditExhaustedNotice(ctx context.Context, msg AiCreditExhaustedMessage) error

	HandleJobApproved(ctx context.Context, msg JobModerationEventMessage) error
	HandleJobRejected(ctx context.Context, msg JobModerationEventMessage) error

	// Application status push notification
	NotifyApplicationStatusChanged(ctx context.Context, candidateID, title, body string, data map[string]string)

	// New applicant notification to recruiter
	NotifyNewApplicant(ctx context.Context, recruiterID, recruiterUserID, applicationID, jobTitle, jobID string)

	// New recruiter registration request notification to admins
	NotifyAdminNewRecruiterRequest(ctx context.Context, msg RecruiterPendingEventMessage)

	// CV analysis done push notification
	NotifyCvAnalysisDone(ctx context.Context, userID, filename string)

	// Assessment submission notifications
	HandleAssessmentSubmitted(ctx context.Context, msg AssessmentEventMessage) error
}

// Service provides high-level notification methods.
type Service struct {
	repo               Repository
	logger             *slog.Logger
	fcmClient          *messaging.Client
	firestoreClient    *firestore.Client
	firebaseAuthClient *auth.Client
	wg                 sync.WaitGroup

	adminEmail   string
	otpService   otp.Service
	emailService email.Service
	smsService   sms.Service
}

// NewService creates a new notification service.
func NewService(
	repo Repository,
	logger *slog.Logger,
	fcmProjectID string,
	fcmServiceAccountJSON string,
	otpService otp.Service,
	emailService email.Service,
	smsService sms.Service,
	adminEmail string,
) *Service {
	s := &Service{
		repo:         repo,
		logger:       logger,
		adminEmail:   adminEmail,
		otpService:   otpService,
		emailService: emailService,
		smsService:   smsService,
	}

	if strings.TrimSpace(fcmProjectID) == "" || strings.TrimSpace(fcmServiceAccountJSON) == "" {
		logger.Warn("FCM not configured; system notifications will be disabled", "fcmProjectIDSet", fcmProjectID != "")
		return s
	}

	ctx := context.Background()
	app, err := firebase.NewApp(ctx, &firebase.Config{ProjectID: fcmProjectID}, option.WithCredentialsJSON([]byte(fcmServiceAccountJSON)))
	if err != nil {
		logger.Error("failed to init firebase app", "err", err)
		return s
	}

	client, err := app.Messaging(ctx)
	if err != nil {
		logger.Error("failed to init firebase messaging client", "err", err)
		return s
	}
	s.fcmClient = client
	logger.Info("FCM service initialized successfully")

	// Initialize Firestore client for realtime notification signals
	fsClient, err := app.Firestore(ctx)
	if err != nil {
		logger.Error("failed to init firestore client", "err", err)
	} else {
		s.firestoreClient = fsClient
		logger.Info("Firestore client initialized successfully")
	}

	// Initialize Firebase Auth client for custom token generation
	authClient, err := app.Auth(ctx)
	if err != nil {
		logger.Error("failed to init firebase auth client", "err", err)
	} else {
		s.firebaseAuthClient = authClient
	}

	return s
}

// CreateNotification creates a persistent notification record.
func (s *Service) CreateNotification(ctx context.Context, receiverID string, receiverType string, title string, body string, notifType string, data datatypes.JSON) error {
	n := Notification{
		ID:            uuid.New(),
		UserID:        receiverID,
		RecipientRole: receiverType,
		Type:          notifType,
		Title:         title,
		Body:          body,
		Data:          data,
		IsRead:        false,
	}

	if err := s.repo.CreateNotification(ctx, n); err != nil {
		s.logger.ErrorContext(ctx, "failed to save notification", "err", err, "receiverID", receiverID)
		return err
	}

	return nil
}

// GetNotificationsHistory returns a paginated list of notifications for a receiver.
func (s *Service) GetNotificationsHistory(ctx context.Context, userID string, receiverType string, page, pageSize int) ([]Notification, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	return s.repo.GetNotifications(ctx, userID, receiverType, pageSize, offset)
}

// MarkAsRead marks a specific notification as read.
func (s *Service) MarkAsRead(ctx context.Context, notificationID string) error {
	nid, err := uuid.Parse(notificationID)
	if err != nil {
		return err
	}

	return s.repo.MarkAsRead(ctx, nid)
}

// MarkAsReadForUser marks a notification as read only if it belongs to the given user.
func (s *Service) MarkAsReadForUser(ctx context.Context, notificationID string, userID string) error {
	nid, err := uuid.Parse(notificationID)
	if err != nil {
		return err
	}
	if err := s.repo.MarkAsReadForUser(ctx, nid, userID); err != nil {
		return err
	}

	// Sync Firestore unread count — lookup notification to get RecipientRole
	notif, err := s.repo.GetNotificationByID(ctx, nid)
	if err == nil && notif != nil {
		s.syncFirestoreUnreadCount(userID, notif.RecipientRole)
	}

	return nil
}

// MarkAllAsRead marks all notifications for a receiver as read.
func (s *Service) MarkAllAsRead(ctx context.Context, receiverID string, receiverType string) error {
	if err := s.repo.MarkAllAsRead(ctx, receiverID, receiverType); err != nil {
		return err
	}

	s.syncFirestoreUnreadCount(receiverID, receiverType)
	return nil
}

// GetUnreadCount returns the current count of unread notifications for a receiver.
func (s *Service) GetUnreadCount(ctx context.Context, receiverID string, receiverType string) (int64, error) {
	return s.repo.GetUnreadCount(ctx, receiverID, receiverType)
}

func (s *Service) CleanupOldNotifications(ctx context.Context, olderThanDays int) (int64, error) {
	return s.repo.DeleteOlderThanDays(ctx, olderThanDays)
}

func (s *Service) DeleteNotificationForUser(ctx context.Context, notificationID string, userID string) error {
	nid, err := uuid.Parse(notificationID)
	if err != nil {
		return err
	}

	// Fetch notification first to get the RecipientRole for Firestore sync before deleting
	notif, err := s.repo.GetNotificationByID(ctx, nid)
	var role string
	if err == nil && notif != nil {
		role = notif.RecipientRole
	}

	if err := s.repo.DeleteNotificationForUser(ctx, nid, userID); err != nil {
		return err
	}

	if role != "" {
		s.syncFirestoreUnreadCount(userID, role)
	}

	return nil
}

// SubscribeFCMToken saves a new FCM registration token for a user.
func (s *Service) SubscribeFCMToken(ctx context.Context, userID string, token string, audience string) error {
	if audience == "" {
		audience = "web-user"
	}
	tok := NewFCMToken(userID, token, audience)
	return s.repo.SaveFCMToken(ctx, &tok)
}

// UnsubscribeFCMToken removes a specific FCM token scoped to the calling user.
func (s *Service) UnsubscribeFCMToken(ctx context.Context, userID string, token string, audience string) error {
	if audience == "" {
		audience = "web-user"
	}
	return s.repo.DeleteFCMTokenByTokenAudienceAndUser(ctx, token, audience, userID)
}

func (s *Service) SendApplicationResultEmail(ctx context.Context, msg ApplicationEventMessage) error {
	return s.emailService.SendApplicationResult(ctx, msg.CandidateEmail, msg.JobTitle, msg.NewStatus, msg.RejectionReason)
}

func (s *Service) HandleRecruiterApproved(ctx context.Context, msg RecruiterStatusEventMessage) error {
	data, _ := json.Marshal(map[string]string{"recruiterId": msg.RecruiterID, "companyName": msg.CompanyName, "url": "/employer/profile"})
	body := fmt.Sprintf("Tài khoản nhà tuyển dụng của công ty %s đã được phê duyệt thành công. Bạn có thể bắt đầu đăng tin tuyển dụng.", msg.CompanyName)
	if err := s.CreateNotification(ctx, msg.RecruiterID, "RECRUITER", "Tài khoản đã được phê duyệt", body, "RECRUITER_APPROVED", data); err != nil {
		s.logger.ErrorContext(ctx, "failed to persist recruiter approved notification", "err", err)
	}
	to := msg.RecruiterEmail
	if to == "" {
		to = msg.ContactEmail
	}
	if to != "" && s.emailService != nil {
		if err := s.emailService.SendRecruiterStatus(ctx, to, msg.CompanyName, "APPROVED", ""); err != nil {
			s.logger.ErrorContext(ctx, "failed to send recruiter approved email", "to", to, "err", err)
		}
	}
	s.sendWebpushToUser(ctx, msg.RecruiterID, "/employer/profile", map[string]string{
		"title": "Tài khoản đã được phê duyệt",
		"body":  body,
		"url":   "/employer/profile",
		"type":  "RECRUITER_APPROVED",
	}, audienceForRecipientRole("RECRUITER"))
	s.syncFirestoreUnreadCount(msg.RecruiterID, "RECRUITER")
	return nil
}

func (s *Service) HandleRecruiterRejected(ctx context.Context, msg RecruiterStatusEventMessage) error {
	data, _ := json.Marshal(map[string]string{"recruiterId": msg.RecruiterID, "companyName": msg.CompanyName, "note": msg.RejectionNote, "url": "/employer/profile"})
	body := fmt.Sprintf("Tài khoản nhà tuyển dụng của công ty %s chưa được phê duyệt.", msg.CompanyName)
	if msg.RejectionNote != "" {
		body += " Lý do: " + msg.RejectionNote
	}
	if err := s.CreateNotification(ctx, msg.RecruiterID, "RECRUITER", "Tài khoản chưa được phê duyệt", body, "RECRUITER_REJECTED", data); err != nil {
		s.logger.ErrorContext(ctx, "failed to persist recruiter rejected notification", "err", err)
	}
	to := msg.RecruiterEmail
	if to == "" {
		to = msg.ContactEmail
	}
	if to != "" && s.emailService != nil {
		if err := s.emailService.SendRecruiterStatus(ctx, to, msg.CompanyName, "REJECTED", msg.RejectionNote); err != nil {
			s.logger.ErrorContext(ctx, "failed to send recruiter rejected email", "to", to, "err", err)
		}
	}
	s.sendWebpushToUser(ctx, msg.RecruiterID, "/employer/profile", map[string]string{
		"title": "Tài khoản chưa được phê duyệt",
		"body":  body,
		"url":   "/employer/profile",
		"type":  "RECRUITER_REJECTED",
	}, audienceForRecipientRole("RECRUITER"))
	s.syncFirestoreUnreadCount(msg.RecruiterID, "RECRUITER")
	return nil
}

func (s *Service) HandleRecruiterBillingNotice(ctx context.Context, msg RecruiterBillingEventMessage) error {
	targetID := msg.RecruiterUserID
	if targetID == "" {
		targetID = msg.RecruiterID
	}

	var title, body, eventType, emailStatus string
	switch msg.EventType {
	case "FEE_APPROACHING":
		title = "Phí sàn sắp đến hạn thanh toán"
		eventType = "RECRUITER_FEE_APPROACHING"
		body = fmt.Sprintf("Phí sàn của công ty %s sẽ đến hạn vào %s. Vui lòng thanh toán để tránh gián đoạn dịch vụ.", msg.CompanyName, msg.DueAt)
		emailStatus = "APPROACHING"
	case "FEE_OVERDUE":
		title = "Phí sàn đã đến hạn thanh toán"
		eventType = "RECRUITER_FEE_OVERDUE"
		body = fmt.Sprintf("Phí sàn của công ty %s đã đến hạn (%s). Vui lòng thanh toán ngay để tránh tài khoản bị khóa sau 3 ngày.", msg.CompanyName, msg.DueAt)
		emailStatus = "OVERDUE"
	case "FEE_LOCKED":
		title = "Tài khoản bị khóa do chưa thanh toán phí sàn"
		eventType = "RECRUITER_FEE_LOCKED"
		body = fmt.Sprintf("Tài khoản nhà tuyển dụng của công ty %s đã bị khóa vì chưa thanh toán phí sàn. Hạn thanh toán: %s.", msg.CompanyName, msg.DueAt)
		emailStatus = "LOCKED"
	default:
		title = "Thông báo phí sàn"
		eventType = "RECRUITER_FEE_DUE"
		body = fmt.Sprintf("Phí sàn của công ty %s cần được thanh toán. Hạn: %s.", msg.CompanyName, msg.DueAt)
		emailStatus = "DUE"
	}

	if err := s.CreateNotification(ctx, targetID, "RECRUITER", title, body, eventType, mustJSON(map[string]string{
		"recruiterId": msg.RecruiterID,
		"companyName": msg.CompanyName,
		"dueAt":       msg.DueAt,
		"lockedAt":    msg.LockedAt,
		"amount":      msg.Amount,
		"url":         "/employer/billing",
	})); err != nil {
		s.logger.ErrorContext(ctx, "failed to persist recruiter billing notification", "err", err)
	}

	if msg.RecruiterEmail != "" && s.emailService != nil {
		if err := s.emailService.SendRecruiterBillingNotice(ctx, msg.RecruiterEmail, msg.CompanyName, emailStatus, msg.DueAt); err != nil {
			s.logger.ErrorContext(ctx, "failed to send recruiter billing email", "to", msg.RecruiterEmail, "err", err)
		}
	}

	// When locked: also notify admin
	if msg.EventType == "FEE_LOCKED" && s.adminEmail != "" && s.emailService != nil {
		if err := s.emailService.SendAdminRecruiterLockNotice(ctx, s.adminEmail, msg.CompanyName, msg.RecruiterEmail, msg.DueAt); err != nil {
			s.logger.ErrorContext(ctx, "failed to send admin lock notice", "err", err)
		}
	}

	if targetID != "" {
		s.sendWebpushToUser(ctx, targetID, "/employer/billing", map[string]string{
			"title":    title,
			"body":     body,
			"url":      "/employer/billing",
			"type":     eventType,
			"company":  msg.CompanyName,
			"dueAt":    msg.DueAt,
			"lockedAt": msg.LockedAt,
			"amount":   msg.Amount,
		}, audienceForRecipientRole("RECRUITER"))
		s.syncFirestoreUnreadCount(targetID, "RECRUITER")
	}
	return nil
}

func (s *Service) HandlePackageExpiredNotice(ctx context.Context, msg PackageExpiredEventMessage) error {
	recipientRole := "CANDIDATE"
	if msg.UserRole == "RECRUITER" {
		recipientRole = "RECRUITER"
	}
	title := "Gói dịch vụ đã hết hạn"
	body := fmt.Sprintf("Gói dịch vụ của bạn đã hết hạn. Tài khoản đã được chuyển về gói miễn phí.")
	if err := s.CreateNotification(ctx, msg.UserID, recipientRole, title, body, "PACKAGE_EXPIRED", mustJSON(map[string]string{
		"packageId": msg.PackageID,
		"expiredAt": msg.ExpiredAt,
		"url":       "/billing",
	})); err != nil {
		s.logger.ErrorContext(ctx, "failed to persist package expired notification", "err", err)
	}
	if msg.UserEmail != "" && s.emailService != nil {
		if err := s.emailService.SendPackageExpiredNotice(ctx, msg.UserEmail, msg.PackageID, msg.ExpiredAt); err != nil {
			s.logger.ErrorContext(ctx, "failed to send package expired email", "to", msg.UserEmail, "err", err)
		}
	}
	if msg.UserID != "" {
		billingURL := "/billing"
		if msg.UserRole == "RECRUITER" {
			billingURL = "/employer/billing"
		}
		s.sendWebpushToUser(ctx, msg.UserID, billingURL, map[string]string{
			"title":     title,
			"body":      body,
			"url":       billingURL,
			"type":      "PACKAGE_EXPIRED",
			"packageId": msg.PackageID,
			"expiredAt": msg.ExpiredAt,
		}, audienceForRecipientRole(recipientRole))
		s.syncFirestoreUnreadCount(msg.UserID, recipientRole)
	}
	return nil
}

func (s *Service) HandleAiCreditExhaustedNotice(ctx context.Context, msg AiCreditExhaustedMessage) error {
	recipientRole := "USER"
	if msg.UserRole == "RECRUITER" {
		recipientRole = "RECRUITER"
	}
	title := "Hết lượt sử dụng AI"
	body := "Bạn đã dùng hết lượt sử dụng AI trong tháng. Vui lòng nâng cấp gói dịch vụ để tiếp tục sử dụng."
	billingURL := "/billing"
	if msg.UserRole == "RECRUITER" {
		billingURL = "/employer/billing"
	}
	if err := s.CreateNotification(ctx, msg.UserID, recipientRole, title, body, "AI_CREDIT_EXHAUSTED", mustJSON(map[string]string{
		"url": billingURL,
	})); err != nil {
		s.logger.ErrorContext(ctx, "failed to persist AI credit exhausted notification", "err", err)
	}
	if msg.UserID != "" {
		s.sendWebpushToUser(ctx, msg.UserID, billingURL, map[string]string{
			"title": title,
			"body":  body,
			"url":   billingURL,
			"type":  "AI_CREDIT_EXHAUSTED",
		}, audienceForRecipientRole(recipientRole))
		s.syncFirestoreUnreadCount(msg.UserID, recipientRole)
	}
	return nil
}


func (s *Service) HandlePackageExpiringSoonNotice(ctx context.Context, msg PackageExpiringSoonMessage) error {
	recipientRole := "CANDIDATE"
	if msg.UserRole == "RECRUITER" {
		recipientRole = "RECRUITER"
	}
	title := "Gói dịch vụ của bạn sắp hết hạn"
	body := fmt.Sprintf("Gói dịch vụ của bạn sẽ hết hạn vào %s. Gia hạn ngay để không gián đoạn dịch vụ.", msg.ExpiresAt)
	if err := s.CreateNotification(ctx, msg.UserID, recipientRole, title, body, "PACKAGE_EXPIRING_SOON", mustJSON(map[string]string{
		"packageId": msg.PackageID,
		"expiresAt": msg.ExpiresAt,
		"url":       "/billing",
	})); err != nil {
		s.logger.ErrorContext(ctx, "failed to persist package expiry warning notification", "err", err)
	}
	if msg.UserEmail != "" && s.emailService != nil {
		if err := s.emailService.SendPackageExpiryWarning(ctx, msg.UserEmail, msg.PackageID, msg.ExpiresAt); err != nil {
			s.logger.ErrorContext(ctx, "failed to send package expiry warning email", "to", msg.UserEmail, "err", err)
		}
	}
	if msg.UserID != "" {
		billingURL := "/billing"
		if msg.UserRole == "RECRUITER" {
			billingURL = "/employer/billing"
		}
		s.sendWebpushToUser(ctx, msg.UserID, billingURL, map[string]string{
			"title":     title,
			"body":      body,
			"url":       billingURL,
			"type":      "PACKAGE_EXPIRING_SOON",
			"packageId": msg.PackageID,
			"expiresAt": msg.ExpiresAt,
		}, audienceForRecipientRole(recipientRole))
		s.syncFirestoreUnreadCount(msg.UserID, recipientRole)
	}
	return nil
}

func (s *Service) HandleJobApproved(ctx context.Context, msg JobModerationEventMessage) error {
	jobURL := fmt.Sprintf("/jobs/%s", msg.JobID)
	data, _ := json.Marshal(map[string]string{"jobId": msg.JobID, "title": msg.Title, "company": msg.Company, "url": jobURL})
	body := fmt.Sprintf("Tin tuyển dụng \"%s\" tại %s đã được phê duyệt và hiển thị công khai.", msg.Title, msg.Company)
	if err := s.CreateNotification(ctx, msg.RecruiterID, "RECRUITER", "Tin tuyển dụng đã được phê duyệt", body, "JOB_APPROVED", data); err != nil {
		s.logger.ErrorContext(ctx, "failed to persist job approved notification", "err", err)
	}
	if msg.RecruiterEmail != "" && s.emailService != nil {
		if err := s.emailService.SendJobModeration(ctx, msg.RecruiterEmail, msg.Title, msg.Company, "APPROVED", ""); err != nil {
			s.logger.ErrorContext(ctx, "failed to send job approved email", "to", msg.RecruiterEmail, "err", err)
		}
	}
	s.sendWebpushToUser(ctx, msg.RecruiterID, jobURL, map[string]string{
		"title": "Tin tuyển dụng đã được phê duyệt",
		"body":  body,
		"url":   jobURL,
		"type":  "JOB_APPROVED",
		"jobId": msg.JobID,
	}, audienceForRecipientRole("RECRUITER"))
	s.syncFirestoreUnreadCount(msg.RecruiterID, "RECRUITER")
	return nil
}

func (s *Service) HandleJobRejected(ctx context.Context, msg JobModerationEventMessage) error {
	jobURL := fmt.Sprintf("/jobs/%s", msg.JobID)
	data, _ := json.Marshal(map[string]string{"jobId": msg.JobID, "title": msg.Title, "company": msg.Company, "note": msg.ModerationNote, "url": jobURL})
	body := fmt.Sprintf("Tin tuyển dụng \"%s\" tại %s chưa được phê duyệt.", msg.Title, msg.Company)
	if msg.ModerationNote != "" {
		body += " Lý do: " + msg.ModerationNote
	}
	if err := s.CreateNotification(ctx, msg.RecruiterID, "RECRUITER", "Tin tuyển dụng chưa được phê duyệt", body, "JOB_REJECTED", data); err != nil {
		s.logger.ErrorContext(ctx, "failed to persist job rejected notification", "err", err)
	}
	if msg.RecruiterEmail != "" && s.emailService != nil {
		if err := s.emailService.SendJobModeration(ctx, msg.RecruiterEmail, msg.Title, msg.Company, "REJECTED", msg.ModerationNote); err != nil {
			s.logger.ErrorContext(ctx, "failed to send job rejected email", "to", msg.RecruiterEmail, "err", err)
		}
	}
	s.sendWebpushToUser(ctx, msg.RecruiterID, jobURL, map[string]string{
		"title": "Tin tuyển dụng chưa được phê duyệt",
		"body":  body,
		"url":   jobURL,
		"type":  "JOB_REJECTED",
		"jobId": msg.JobID,
	}, audienceForRecipientRole("RECRUITER"))
	s.syncFirestoreUnreadCount(msg.RecruiterID, "RECRUITER")
	return nil
}

func (s *Service) NotifyNewOrder(ctx context.Context, userID string, vendorID string, orderNo string, totalAmount int) {
	title := "Đơn hàng mới!"
	body := fmt.Sprintf("Mã đơn: %s - %dđ", orderNo, totalAmount)

	// 1. Persist notification to DB for history
	if userID != "" {
		data, err := json.Marshal(map[string]string{"orderNumber": orderNo, "vendorID": vendorID})
		if err != nil {
			s.logger.Error("failed to marshal new order notification data", "err", err)
		} else if err := s.CreateNotification(ctx, userID, "VENDOR", title, body, "ORDER_NEW", data); err != nil {
			s.logger.Error("failed to persist new order notification", "userID", userID, "err", err)
		}
	}

	// 2. Update Firestore signal doc (non-blocking goroutine)
	s.updateFirestoreSignal(userID, "NEW_ORDER", map[string]string{
		"audience":    audienceForRecipientRole("VENDOR"),
		"orderNumber": orderNo,
		"totalAmount": strconv.Itoa(totalAmount),
		"message":     fmt.Sprintf("Mã đơn: %s - %dđ", orderNo, totalAmount),
	})

	// 3. Send FCM push (requires valid userID + fcmClient)
	s.sendWebpushToUser(ctx, userID, "/orders", map[string]string{
		"title":       title,
		"body":        body,
		"url":         "/orders",
		"orderNumber": orderNo,
		"totalAmount": strconv.Itoa(totalAmount),
	}, audienceForRecipientRole("VENDOR"))
}

func (s *Service) NotifyOrderPlaced(ctx context.Context, userID string, orderID string, orderNo string, totalAmount int) {
	title := "Đặt hàng thành công"
	body := fmt.Sprintf("Đơn hàng %s đã được ghi nhận", orderNo)
	orderURL := fmt.Sprintf("/orders/%s", orderID)

	if userID != "" {
		data, err := json.Marshal(map[string]string{
			"orderID":     orderID,
			"orderNumber": orderNo,
		})
		if err != nil {
			s.logger.Error("failed to marshal order placed notification data", "err", err)
		} else if err := s.CreateNotification(ctx, userID, "USER", title, body, "ORDER_PLACED", data); err != nil {
			s.logger.Error("failed to persist order placed notification", "userID", userID, "orderID", orderID, "err", err)
		}
	}

	s.updateFirestoreSignal(userID, "ORDER_PLACED", map[string]string{
		"audience":    audienceForRecipientRole("USER"),
		"orderID":     orderID,
		"orderNumber": orderNo,
		"totalAmount": strconv.Itoa(totalAmount),
		"message":     body,
	})

	s.sendWebpushToUser(ctx, userID, orderURL, map[string]string{
		"title":       title,
		"body":        body,
		"url":         orderURL,
		"orderID":     orderID,
		"orderNumber": orderNo,
		"totalAmount": strconv.Itoa(totalAmount),
	}, audienceForRecipientRole("USER"))
}

// NotifyApplicationStatusChanged persists a notification and sends an FCM push to the candidate.
func (s *Service) NotifyApplicationStatusChanged(ctx context.Context, candidateID, title, body string, data map[string]string) {
	jsonData, _ := json.Marshal(data)
	if err := s.CreateNotification(ctx, candidateID, "USER", title, body, "APPLICATION_STATUS", jsonData); err != nil {
		s.logger.Error("failed to persist application status notification", "candidateID", candidateID, "err", err)
	}
	s.sendWebpushToUser(ctx, candidateID, "/applications", data, audienceForRecipientRole("USER"))
	s.syncFirestoreUnreadCount(candidateID, "USER")
}

// NotifyNewApplicant persists a notification and sends an FCM push to the recruiter when a candidate applies.
// recruiterUserID is the recruiter's User._id (JWT subject) used for FCM token lookup and notification storage.
func (s *Service) NotifyNewApplicant(ctx context.Context, recruiterID, recruiterUserID, applicationID, jobTitle, jobID string) {
	notifTarget := recruiterUserID
	if notifTarget == "" {
		notifTarget = recruiterID
	}
	if notifTarget == "" {
		return
	}
	title := "New Application Received"
	body := fmt.Sprintf("A candidate has applied for \"%s\".", jobTitle)
	url := fmt.Sprintf("/employer/applicants/%s", applicationID)
	dataMap := map[string]string{
		"type":          "NEW_APPLICANT",
		"applicationId": applicationID,
		"jobId":         jobID,
		"jobTitle":      jobTitle,
		"url":           url,
	}
	jsonData, _ := json.Marshal(dataMap)
	if err := s.CreateNotification(ctx, notifTarget, "RECRUITER", title, body, "NEW_APPLICANT", jsonData); err != nil {
		s.logger.Error("failed to persist new applicant notification", "notifTarget", notifTarget, "err", err)
	}
	s.sendWebpushToUser(ctx, notifTarget, url, dataMap, audienceForRecipientRole("RECRUITER"))
	s.syncFirestoreUnreadCount(notifTarget, "RECRUITER")
}

// NotifyAdminNewRecruiterRequest persists a notification and sends an FCM push to each admin when a recruiter submits for approval.
func (s *Service) NotifyAdminNewRecruiterRequest(ctx context.Context, msg RecruiterPendingEventMessage) {
	if len(msg.AdminUserIDs) == 0 {
		return
	}
	title := "New Recruiter Registration Request"
	body := fmt.Sprintf("Company \"%s\" has submitted a registration request for review.", msg.CompanyName)
	url := "/admin/employer-verification"
	dataMap := map[string]string{
		"type":        "RECRUITER_PENDING",
		"recruiterId": msg.RecruiterID,
		"companyName": msg.CompanyName,
		"url":         url,
	}
	jsonData, _ := json.Marshal(dataMap)
	for _, adminID := range msg.AdminUserIDs {
		if err := s.CreateNotification(ctx, adminID, "ADMIN", title, body, "RECRUITER_PENDING", jsonData); err != nil {
			s.logger.Error("failed to persist admin recruiter-pending notification", "adminID", adminID, "err", err)
		}
		s.sendWebpushToUser(ctx, adminID, url, dataMap, audienceForRecipientRole("ADMIN"))
		s.syncFirestoreUnreadCount(adminID, "ADMIN")
	}
}

// NotifyCvAnalysisDone persists a notification and sends an FCM push to the candidate after CV analysis completes.
func (s *Service) NotifyCvAnalysisDone(ctx context.Context, userID, filename string) {
	title := "CV Analysis Complete 🎉"
	body := fmt.Sprintf("Your CV \"%s\" has been analyzed. View your results now.", filename)
	data := map[string]string{
		"type":     "CV_ANALYSIS_DONE",
		"url":      "/cv",
		"filename": filename,
	}
	jsonData, _ := json.Marshal(data)
	if err := s.CreateNotification(ctx, userID, "USER", title, body, "CV_ANALYSIS_DONE", jsonData); err != nil {
		s.logger.Error("failed to persist cv analysis done notification", "userID", userID, "err", err)
	}
	s.sendWebpushToUser(ctx, userID, "/cv", map[string]string{
		"title":    title,
		"body":     body,
		"url":      "/cv",
		"type":     "CV_ANALYSIS_DONE",
		"filename": filename,
	}, audienceForRecipientRole("USER"))
	s.syncFirestoreUnreadCount(userID, "USER")
}

func (s *Service) sendWebpushToUser(ctx context.Context, userID string, url string, data map[string]string, audience string) {
	if userID == "" || s.fcmClient == nil || !isSupportedAudience(audience) {
		return
	}

	tokens, err := s.repo.GetFCMTokensByUserIDAndAudience(ctx, userID, audience)
	if err != nil {
		s.logger.Error("failed to fetch fcm tokens", "userID", userID, "audience", audience, "err", err)
		return
	}

	if len(tokens) == 0 {
		return
	}

	// Bounded concurrency to prevent goroutine explosion under load
	sem := make(chan struct{}, 10)
	for _, t := range tokens {
		if strings.TrimSpace(t.Token) == "" {
			continue
		}

		s.wg.Add(1)
		sem <- struct{}{}
		go func(targetToken string, targetAudience string) {
			defer s.wg.Done()
			defer func() { <-sem }()

			bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			msg := &messaging.Message{
				Data:  data,
				Token: targetToken,
				Webpush: &messaging.WebpushConfig{
					Headers: map[string]string{
						"Urgency": "high",
						"TTL":     "120",
					},
					FCMOptions: &messaging.WebpushFCMOptions{
						Link: url,
					},
				},
			}

			_, err := s.fcmClient.Send(bgCtx, msg)
			if err != nil {
				s.logger.Warn("failed to send fcm message", "token", targetToken, "err", err)

				errText := strings.ToLower(err.Error())
				if strings.Contains(errText, "not-registered") ||
					strings.Contains(errText, "registration-token-not-registered") ||
					strings.Contains(errText, "invalid-registration-token") {
					_ = s.repo.DeleteFCMTokenByTokenAndAudience(bgCtx, targetToken, targetAudience)
					s.logger.Info("deleted invalid fcm token", "token", targetToken, "audience", targetAudience)
				}
				return
			}

			s.logger.Debug("FCM message sent successfully", "token", targetToken)
		}(t.Token, audience)
	}
}

func (s *Service) GenerateFirebaseToken(ctx context.Context, userID string) (string, error) {
	if s.firebaseAuthClient == nil {
		return "", fmt.Errorf("firebase auth client not initialized")
	}
	return s.firebaseAuthClient.CustomToken(ctx, userID)
}

func (s *Service) NotifyOrderStatusUpdated(ctx context.Context, userID string, orderID string, subOrderID string, orderNo string, status string, trackingCode *string, shippingProvider *string) {
	// Implementation placeholder
}

func (s *Service) SendOTP(ctx context.Context, target string, targetType string, otpType string, ttlMinutes int) error {
	code, err := s.otpService.GenerateOTP(ctx, target, targetType, otpType, ttlMinutes)
	if err != nil {
		return err
	}

	switch strings.ToUpper(targetType) {
	case "EMAIL":
		return s.emailService.SendOTP(ctx, target, code, ttlMinutes)
	case "SMS":
		return s.smsService.SendOTP(ctx, target, code, ttlMinutes)
	default:
		return fmt.Errorf("unsupported target type: %s", targetType)
	}
}

func (s *Service) VerifyOTP(ctx context.Context, target string, targetType string, otpType string, code string) (bool, error) {
	return s.otpService.VerifyOTP(ctx, target, targetType, otpType, code)
}

func (s *Service) syncFirestoreUnreadCount(userID string, role string) {
	if s.firestoreClient == nil {
		return
	}
	ctx := context.Background()
	unreadCount, err := s.GetUnreadCount(ctx, userID, role)
	if err != nil {
		s.logger.Error("failed to get unread count for sync", "userID", userID, "err", err)
		return
	}

	docRef := s.firestoreClient.Collection("notifications").Doc(userID)
	_, err = docRef.Set(ctx, map[string]interface{}{
		"unreadCount": unreadCount,
		"updatedAt":   time.Now(),
		"role":        role,
	}, firestore.MergeAll)
	if err != nil {
		s.logger.Error("failed to sync unread count to firestore", "userID", userID, "err", err)
	}
}

func (s *Service) updateFirestoreSignal(userID string, signalType string, data map[string]string) {
	if s.firestoreClient == nil {
		return
	}
	ctx := context.Background()
	docRef := s.firestoreClient.Collection("signals").Doc(userID)

	payload := map[string]interface{}{
		"type":      signalType,
		"data":      data,
		"timestamp": time.Now(),
	}

	_, err := docRef.Set(ctx, payload)
	if err != nil {
		s.logger.Error("failed to update firestore signal", "userID", userID, "err", err)
	}
}

func audienceForRecipientRole(role string) string {
	switch role {
	case "VENDOR", "RECRUITER":
		// Tokens are stored under "web-vendor" by audienceFromScope (ROLE_RECRUITER → web-vendor).
		// Both VENDOR and RECRUITER map to the same recruiter audience string.
		return "web-vendor"
	case "ADMIN":
		return "web-admin"
	default:
		return "web-user"
	}
}

func (s *Service) HandleAssessmentSubmitted(ctx context.Context, msg AssessmentEventMessage) error {
	resultLabel := msg.Result
	if msg.Overtime {
		resultLabel = "OVERTIME"
	}

	candidateData, _ := json.Marshal(map[string]string{
		"type":         "ASSESSMENT_SUBMITTED",
		"assessmentId": msg.AssessmentID,
		"attemptId":    msg.AttemptID,
		"result":       resultLabel,
		"layout":       "/assessments",
	})
	if err := s.CreateNotification(ctx, msg.CandidateID, "USER",
		"Bài kiểm tra đã được nộp",
		"Kết quả bài kiểm tra của bạn: "+resultLabel,
		"ASSESSMENT_SUBMITTED",
		candidateData); err != nil {
		s.logger.ErrorContext(ctx, "failed to create candidate assessment notification", "candidateId", msg.CandidateID, "err", err)
	}

	if msg.RecruiterUserID != "" {
		recruiterData, _ := json.Marshal(map[string]string{
			"type":         "ASSESSMENT_SUBMITTED",
			"assessmentId": msg.AssessmentID,
			"attemptId":    msg.AttemptID,
			"result":       resultLabel,
			"layout":       "/employer/assessments",
		})
		if err := s.CreateNotification(ctx, msg.RecruiterUserID, "RECRUITER",
			"Ứng viên đã nộp bài kiểm tra",
			"Bài kiểm tra \""+msg.AssessmentTitle+"\": "+resultLabel,
			"ASSESSMENT_SUBMITTED",
			recruiterData); err != nil {
			s.logger.ErrorContext(ctx, "failed to create recruiter assessment notification", "recruiterUserId", msg.RecruiterUserID, "err", err)
		}
	}
	return nil
}

func isSupportedAudience(audience string) bool {
	switch audience {
	case "web-user", "web-vendor", "web-admin":
		return true
	default:
		return false
	}
}

func mustJSON(v any) datatypes.JSON {
	b, err := json.Marshal(v)
	if err != nil {
		return datatypes.JSON([]byte("{}"))
	}
	return datatypes.JSON(b)
}
