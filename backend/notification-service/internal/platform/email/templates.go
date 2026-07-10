package email

import (
	"bytes"
	"embed"
	"fmt"
	"html/template"
)

//go:embed templates/*.html
var templateFS embed.FS

var otpTemplate = template.Must(template.ParseFS(templateFS, "templates/otp.html"))
var applicationResultTemplate = template.Must(template.ParseFS(templateFS, "templates/application_result.html"))
var recruiterStatusTemplate = template.Must(template.ParseFS(templateFS, "templates/recruiter_status.html"))
var jobModerationTemplate = template.Must(template.ParseFS(templateFS, "templates/job_moderation.html"))
var recruiterBillingNoticeTemplate = template.Must(template.ParseFS(templateFS, "templates/recruiter_billing_notice.html"))
var adminRecruiterLockTemplate = template.Must(template.ParseFS(templateFS, "templates/admin_recruiter_lock.html"))
var packageExpiredTemplate = template.Must(template.ParseFS(templateFS, "templates/package_expired.html"))
var packageExpiryWarningTemplate = template.Must(template.ParseFS(templateFS, "templates/package_expiry_warning.html"))

type otpTemplateData struct {
	Code       string
	TTLMinutes int
}

type applicationResultData struct {
	JobTitle        string
	Status          string
	RejectionReason string
}

type recruiterStatusData struct {
	CompanyName string
	Status      string
	Note        string
}

type jobModerationData struct {
	JobTitle string
	Company  string
	Status   string
	Note     string
}

type recruiterBillingNoticeData struct {
	CompanyName string
	Status      string
	DueAt       string
}

type adminRecruiterLockData struct {
	CompanyName    string
	RecruiterEmail string
	DueAt          string
}

type packageExpiredData struct {
	PackageID string
	ExpiredAt string
}

type packageExpiryWarningData struct {
	PackageID string
	ExpiresAt string
}

func renderOTPEmail(code string, ttlMinutes int) (htmlBody, plain string) {
	plain = fmt.Sprintf(
		"Mã xác thực Smart CV\n\nMã xác thực của bạn là: %s\n\nMã có hiệu lực trong %d phút.\nNếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.",
		code, ttlMinutes,
	)

	var buf bytes.Buffer
	data := otpTemplateData{Code: code, TTLMinutes: ttlMinutes}
	if err := otpTemplate.Execute(&buf, data); err != nil {
		return plain, plain
	}

	return buf.String(), plain
}

func renderApplicationResultEmail(jobTitle, status, rejectionReason string) (htmlBody, plain string) {
	plain = fmt.Sprintf("Kết quả ứng tuyển %s: %s", jobTitle, status)
	if rejectionReason != "" {
		plain += "\nLý do: " + rejectionReason
	}

	var buf bytes.Buffer
	data := applicationResultData{JobTitle: jobTitle, Status: status, RejectionReason: rejectionReason}
	if err := applicationResultTemplate.Execute(&buf, data); err != nil {
		return plain, plain
	}
	return buf.String(), plain
}

func renderRecruiterStatusEmail(companyName, status, note string) (htmlBody, plain string) {
	if status == "APPROVED" {
		plain = fmt.Sprintf("Tài khoản nhà tuyển dụng của công ty %s đã được phê duyệt thành công.", companyName)
	} else {
		plain = fmt.Sprintf("Tài khoản nhà tuyển dụng của công ty %s chưa được phê duyệt.", companyName)
		if note != "" {
			plain += "\nLý do: " + note
		}
	}
	var buf bytes.Buffer
	data := recruiterStatusData{CompanyName: companyName, Status: status, Note: note}
	if err := recruiterStatusTemplate.Execute(&buf, data); err != nil {
		return plain, plain
	}
	return buf.String(), plain
}

func renderJobModerationEmail(jobTitle, company, status, note string) (htmlBody, plain string) {
	if status == "APPROVED" {
		plain = fmt.Sprintf("Tin tuyển dụng \"%s\" tại %s đã được phê duyệt và hiển thị công khai.", jobTitle, company)
	} else {
		plain = fmt.Sprintf("Tin tuyển dụng \"%s\" tại %s chưa được phê duyệt.", jobTitle, company)
		if note != "" {
			plain += "\nLý do: " + note
		}
	}
	var buf bytes.Buffer
	data := jobModerationData{JobTitle: jobTitle, Company: company, Status: status, Note: note}
	if err := jobModerationTemplate.Execute(&buf, data); err != nil {
		return plain, plain
	}
	return buf.String(), plain
}

func renderRecruiterBillingNoticeEmail(companyName, status, dueAt string) (htmlBody, plain string) {
	switch status {
	case "APPROACHING":
		plain = fmt.Sprintf("Phí sàn của công ty %s sẽ đến hạn vào %s. Vui lòng thanh toán để tránh gián đoạn dịch vụ.", companyName, dueAt)
	case "OVERDUE":
		plain = fmt.Sprintf("Phí sàn của công ty %s đã đến hạn (%s). Vui lòng thanh toán ngay để tránh bị khóa tài khoản.", companyName, dueAt)
	case "LOCKED":
		plain = fmt.Sprintf("Tài khoản nhà tuyển dụng của công ty %s đã bị khóa do chưa thanh toán phí sàn. Hạn thanh toán: %s. Để mở khóa, vui lòng liên hệ admin SmartCV.", companyName, dueAt)
	default:
		plain = fmt.Sprintf("Phí sàn của công ty %s cần được thanh toán. Hạn: %s.", companyName, dueAt)
	}
	var buf bytes.Buffer
	data := recruiterBillingNoticeData{CompanyName: companyName, Status: status, DueAt: dueAt}
	if err := recruiterBillingNoticeTemplate.Execute(&buf, data); err != nil {
		return plain, plain
	}
	return buf.String(), plain
}

func renderAdminRecruiterLockEmail(companyName, recruiterEmail, dueAt string) (htmlBody, plain string) {
	plain = fmt.Sprintf("Nhà tuyển dụng %s (email: %s) đã bị khóa tài khoản do chưa thanh toán phí sàn. Hạn thanh toán: %s.", companyName, recruiterEmail, dueAt)
	var buf bytes.Buffer
	data := adminRecruiterLockData{CompanyName: companyName, RecruiterEmail: recruiterEmail, DueAt: dueAt}
	if err := adminRecruiterLockTemplate.Execute(&buf, data); err != nil {
		return plain, plain
	}
	return buf.String(), plain
}

func renderPackageExpiredEmail(packageID, expiredAt string) (htmlBody, plain string) {
	plain = fmt.Sprintf("Gói dịch vụ của bạn (%s) đã hết hạn vào %s. Tài khoản đã được chuyển về gói miễn phí.", packageID, expiredAt)
	var buf bytes.Buffer
	data := packageExpiredData{PackageID: packageID, ExpiredAt: expiredAt}
	if err := packageExpiredTemplate.Execute(&buf, data); err != nil {
		return plain, plain
	}
	return buf.String(), plain
}

func renderPackageExpiryWarningEmail(packageID, expiresAt string) (htmlBody, plain string) {
	plain = fmt.Sprintf("Gói dịch vụ của bạn (%s) sẽ hết hạn vào %s. Vui lòng gia hạn để tiếp tục sử dụng.", packageID, expiresAt)
	var buf bytes.Buffer
	data := packageExpiryWarningData{PackageID: packageID, ExpiresAt: expiresAt}
	if err := packageExpiryWarningTemplate.Execute(&buf, data); err != nil {
		return plain, plain
	}
	return buf.String(), plain
}
