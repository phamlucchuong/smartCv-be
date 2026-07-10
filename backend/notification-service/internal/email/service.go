package email

import "context"

type EmailProvider interface {
	SendOTP(ctx context.Context, to string, code string, ttlMinutes int) error
	SendApplicationResult(ctx context.Context, to, jobTitle, status, rejectionReason string) error
	SendRecruiterStatus(ctx context.Context, to, companyName, status, note string) error
	SendJobModeration(ctx context.Context, to, jobTitle, company, status, note string) error
	SendRecruiterBillingNotice(ctx context.Context, to, companyName, status, dueAt string) error
	SendAdminRecruiterLockNotice(ctx context.Context, adminEmail, companyName, recruiterEmail, dueAt string) error
	SendPackageExpiredNotice(ctx context.Context, to, packageID, expiredAt string) error
	SendPackageExpiryWarning(ctx context.Context, to, packageID, expiresAt string) error
}

type Service interface {
	SendOTP(ctx context.Context, to string, code string, ttlMinutes int) error
	SendApplicationResult(ctx context.Context, to, jobTitle, status, rejectionReason string) error
	SendRecruiterStatus(ctx context.Context, to, companyName, status, note string) error
	SendJobModeration(ctx context.Context, to, jobTitle, company, status, note string) error
	SendRecruiterBillingNotice(ctx context.Context, to, companyName, status, dueAt string) error
	SendAdminRecruiterLockNotice(ctx context.Context, adminEmail, companyName, recruiterEmail, dueAt string) error
	SendPackageExpiredNotice(ctx context.Context, to, packageID, expiredAt string) error
	SendPackageExpiryWarning(ctx context.Context, to, packageID, expiresAt string) error
}

type emailService struct {
	provider EmailProvider
}

func NewService(provider EmailProvider) Service {
	return &emailService{provider: provider}
}

func (s *emailService) SendOTP(ctx context.Context, to string, code string, ttlMinutes int) error {
	if s.provider == nil {
		return ErrProviderNotConfigured
	}
	return s.provider.SendOTP(ctx, to, code, ttlMinutes)
}

func (s *emailService) SendApplicationResult(ctx context.Context, to, jobTitle, status, rejectionReason string) error {
	if s.provider == nil {
		return ErrProviderNotConfigured
	}
	return s.provider.SendApplicationResult(ctx, to, jobTitle, status, rejectionReason)
}

func (s *emailService) SendRecruiterStatus(ctx context.Context, to, companyName, status, note string) error {
	if s.provider == nil {
		return ErrProviderNotConfigured
	}
	return s.provider.SendRecruiterStatus(ctx, to, companyName, status, note)
}

func (s *emailService) SendJobModeration(ctx context.Context, to, jobTitle, company, status, note string) error {
	if s.provider == nil {
		return ErrProviderNotConfigured
	}
	return s.provider.SendJobModeration(ctx, to, jobTitle, company, status, note)
}

func (s *emailService) SendRecruiterBillingNotice(ctx context.Context, to, companyName, status, dueAt string) error {
	if s.provider == nil {
		return ErrProviderNotConfigured
	}
	return s.provider.SendRecruiterBillingNotice(ctx, to, companyName, status, dueAt)
}

func (s *emailService) SendAdminRecruiterLockNotice(ctx context.Context, adminEmail, companyName, recruiterEmail, dueAt string) error {
	if s.provider == nil {
		return ErrProviderNotConfigured
	}
	return s.provider.SendAdminRecruiterLockNotice(ctx, adminEmail, companyName, recruiterEmail, dueAt)
}

func (s *emailService) SendPackageExpiredNotice(ctx context.Context, to, packageID, expiredAt string) error {
	if s.provider == nil {
		return ErrProviderNotConfigured
	}
	return s.provider.SendPackageExpiredNotice(ctx, to, packageID, expiredAt)
}

func (s *emailService) SendPackageExpiryWarning(ctx context.Context, to, packageID, expiresAt string) error {
	if s.provider == nil {
		return ErrProviderNotConfigured
	}
	return s.provider.SendPackageExpiryWarning(ctx, to, packageID, expiresAt)
}
