package email

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"strings"
	"time"
)

const smtpTimeout = 10 * time.Second

// EmailService defines email sending capabilities.
type EmailService interface {
	SendOTP(to, code string, ttlMinutes int) error
	SendApplicationResult(to, jobTitle, status, rejectionReason string) error
	SendRecruiterBillingNotice(to, companyName, status, dueAt string) error
}

// Service implements EmailService via SMTP.
type Service struct {
	host     string
	port     string
	user     string
	password string
	fromMail string
	fromName string
}

func NewService(host, port, user, password, fromMail, fromName string) *Service {
	if user == "" || password == "" {
		return nil
	}

	normalizedFromMail, normalizedFromName := normalizeFromAddress(fromMail, fromName, user)

	return &Service{
		host:     host,
		port:     port,
		user:     user,
		password: password,
		fromMail: normalizedFromMail,
		fromName: normalizedFromName,
	}
}

func (s *Service) SendOTP(ctx context.Context, to, code string, ttlMinutes int) error {
	if containsCRLF(to) {
		return fmt.Errorf("invalid recipient address")
	}

	subject := "Mã xác thực Smart CV"
	htmlBody, plainBody := renderOTPEmail(code, ttlMinutes)

	return s.sendMultipart(to, subject, htmlBody, plainBody)
}

func (s *Service) SendApplicationResult(ctx context.Context, to, jobTitle, status, rejectionReason string) error {
	if containsCRLF(to) {
		return fmt.Errorf("invalid recipient address")
	}
	subject := fmt.Sprintf("Kết quả ứng tuyển: %s", jobTitle)
	htmlBody, plainBody := renderApplicationResultEmail(jobTitle, status, rejectionReason)
	return s.sendMultipart(to, subject, htmlBody, plainBody)
}

func (s *Service) SendRecruiterStatus(ctx context.Context, to, companyName, status, note string) error {
	if s == nil {
		return nil
	}
	if containsCRLF(to) {
		return fmt.Errorf("invalid recipient address")
	}
	var subject string
	if status == "APPROVED" {
		subject = fmt.Sprintf("Tài khoản nhà tuyển dụng đã được phê duyệt: %s", companyName)
	} else {
		subject = fmt.Sprintf("Tài khoản nhà tuyển dụng chưa được phê duyệt: %s", companyName)
	}
	htmlBody, plainBody := renderRecruiterStatusEmail(companyName, status, note)
	return s.sendMultipart(to, subject, htmlBody, plainBody)
}

func (s *Service) SendJobModeration(ctx context.Context, to, jobTitle, company, status, note string) error {
	if s == nil {
		return nil
	}
	if containsCRLF(to) {
		return fmt.Errorf("invalid recipient address")
	}
	var subject string
	if status == "APPROVED" {
		subject = fmt.Sprintf("Tin tuyển dụng đã được phê duyệt: %s", jobTitle)
	} else {
		subject = fmt.Sprintf("Tin tuyển dụng chưa được phê duyệt: %s", jobTitle)
	}
	htmlBody, plainBody := renderJobModerationEmail(jobTitle, company, status, note)
	return s.sendMultipart(to, subject, htmlBody, plainBody)
}

func (s *Service) SendRecruiterBillingNotice(ctx context.Context, to, companyName, status, dueAt string) error {
	if s == nil {
		return nil
	}
	if containsCRLF(to) {
		return fmt.Errorf("invalid recipient address")
	}
	var subject string
	switch status {
	case "APPROACHING":
		subject = fmt.Sprintf("[SmartCV] Phí sàn sắp đến hạn: %s", companyName)
	case "OVERDUE":
		subject = fmt.Sprintf("[SmartCV] Phí sàn đã đến hạn thanh toán: %s", companyName)
	case "LOCKED":
		subject = fmt.Sprintf("[SmartCV] Tài khoản nhà tuyển dụng bị khóa: %s", companyName)
	default:
		subject = fmt.Sprintf("[SmartCV] Thông báo phí sàn: %s", companyName)
	}
	htmlBody, plainBody := renderRecruiterBillingNoticeEmail(companyName, status, dueAt)
	return s.sendMultipart(to, subject, htmlBody, plainBody)
}

func (s *Service) SendAdminRecruiterLockNotice(ctx context.Context, adminEmail, companyName, recruiterEmail, dueAt string) error {
	if s == nil {
		return nil
	}
	if containsCRLF(adminEmail) {
		return fmt.Errorf("invalid recipient address")
	}
	subject := fmt.Sprintf("[SmartCV Admin] Nhà tuyển dụng bị khóa do chưa thanh toán phí sàn: %s", companyName)
	htmlBody, plainBody := renderAdminRecruiterLockEmail(companyName, recruiterEmail, dueAt)
	return s.sendMultipart(adminEmail, subject, htmlBody, plainBody)
}

func (s *Service) SendPackageExpiredNotice(ctx context.Context, to, packageID, expiredAt string) error {
	if s == nil {
		return nil
	}
	if containsCRLF(to) {
		return fmt.Errorf("invalid recipient address")
	}
	subject := "[SmartCV] Gói dịch vụ của bạn đã hết hạn"
	htmlBody, plainBody := renderPackageExpiredEmail(packageID, expiredAt)
	return s.sendMultipart(to, subject, htmlBody, plainBody)
}

func (s *Service) SendPackageExpiryWarning(ctx context.Context, to, packageID, expiresAt string) error {
	if s == nil {
		return nil
	}
	if containsCRLF(to) {
		return fmt.Errorf("invalid recipient address")
	}
	subject := "[SmartCV] Gói dịch vụ của bạn sắp hết hạn"
	htmlBody, plainBody := renderPackageExpiryWarningEmail(packageID, expiresAt)
	return s.sendMultipart(to, subject, htmlBody, plainBody)
}

func (s *Service) sendMultipart(to, subject, htmlBody, plainBody string) error {
	boundary := generateBoundary()

	var msg strings.Builder
	if s.fromName != "" {
		fmt.Fprintf(&msg, "From: %s <%s>\r\n", s.fromName, s.fromMail)
	} else {
		fmt.Fprintf(&msg, "From: %s\r\n", s.fromMail)
	}
	fmt.Fprintf(&msg, "To: %s\r\n", to)
	fmt.Fprintf(&msg, "Subject: %s\r\n", mime.QEncoding.Encode("UTF-8", subject))
	msg.WriteString("MIME-Version: 1.0\r\n")
	fmt.Fprintf(&msg, "Content-Type: multipart/alternative; boundary=%q\r\n", boundary)
	msg.WriteString("\r\n")

	fmt.Fprintf(&msg, "--%s\r\n", boundary)
	msg.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	msg.WriteString("Content-Transfer-Encoding: quoted-printable\r\n\r\n")
	msg.WriteString(plainBody)
	msg.WriteString("\r\n")

	fmt.Fprintf(&msg, "--%s\r\n", boundary)
	msg.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	msg.WriteString("Content-Transfer-Encoding: quoted-printable\r\n\r\n")
	msg.WriteString(htmlBody)
	msg.WriteString("\r\n")

	fmt.Fprintf(&msg, "--%s--\r\n", boundary)

	return s.dialAndSend(to, msg.String())
}

func (s *Service) dialAndSend(to, message string) error {
	addr := s.host + ":" + s.port

	conn, err := net.DialTimeout("tcp", addr, smtpTimeout)
	if err != nil {
		return fmt.Errorf("smtp dial: %w", err)
	}
	defer conn.Close()

	if err := conn.SetDeadline(time.Now().Add(smtpTimeout)); err != nil {
		return fmt.Errorf("smtp set deadline: %w", err)
	}

	client, err := smtp.NewClient(conn, s.host)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer client.Close()

	tlsCfg := &tls.Config{ServerName: s.host}
	if err := client.StartTLS(tlsCfg); err != nil {
		return fmt.Errorf("smtp starttls: %w", err)
	}

	auth := smtp.PlainAuth("", s.user, s.password, s.host)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("smtp auth: %w", err)
	}

	if err := client.Mail(s.fromMail); err != nil {
		return fmt.Errorf("smtp mail from: %w", err)
	}
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("smtp rcpt to: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	if _, err := w.Write([]byte(message)); err != nil {
		return fmt.Errorf("smtp write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("smtp close data: %w", err)
	}

	return client.Quit()
}

func containsCRLF(s string) bool {
	return strings.ContainsAny(s, "\r\n")
}

func generateBoundary() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return "==SmartCV" + hex.EncodeToString(b) + "=="
}

func normalizeFromAddress(fromMail, fromName, fallback string) (string, string) {
	trimmedMail := strings.TrimSpace(fromMail)
	trimmedName := strings.TrimSpace(fromName)

	if trimmedMail == "" {
		trimmedMail = strings.TrimSpace(fallback)
	}

	if parsed, err := mail.ParseAddress(trimmedMail); err == nil {
		if trimmedName == "" {
			trimmedName = parsed.Name
		}
		trimmedMail = parsed.Address
	}

	if trimmedMail == "" {
		trimmedMail = strings.TrimSpace(fallback)
	}

	return trimmedMail, trimmedName
}
