package email

import (
	"context"
	"errors"
	"testing"
)

type stubEmailProvider struct {
	lastTo         string
	lastCode       string
	lastTTLMinutes int
}

func (s *stubEmailProvider) SendOTP(_ context.Context, to string, code string, ttlMinutes int) error {
	s.lastTo = to
	s.lastCode = code
	s.lastTTLMinutes = ttlMinutes
	return nil
}

func (s *stubEmailProvider) SendApplicationResult(_ context.Context, _, _, _, _ string) error {
	return nil
}

func (s *stubEmailProvider) SendRecruiterStatus(_ context.Context, _, _, _, _ string) error {
	return nil
}

func (s *stubEmailProvider) SendJobModeration(_ context.Context, _, _, _, _, _ string) error {
	return nil
}

func (s *stubEmailProvider) SendRecruiterBillingNotice(_ context.Context, _, _, _, _ string) error {
	return nil
}

func (s *stubEmailProvider) SendAdminRecruiterLockNotice(_ context.Context, _, _, _, _ string) error {
	return nil
}

func (s *stubEmailProvider) SendPackageExpiredNotice(_ context.Context, _, _, _ string) error {
	return nil
}

func (s *stubEmailProvider) SendPackageExpiryWarning(_ context.Context, _, _, _ string) error {
	return nil
}

func TestSendOTPReturnsProviderNotConfiguredWhenProviderIsNil(t *testing.T) {
	svc := NewService(nil)

	err := svc.SendOTP(context.Background(), "test@example.com", "123456", 5)
	if !errors.Is(err, ErrProviderNotConfigured) {
		t.Fatalf("expected ErrProviderNotConfigured, got %v", err)
	}
}

func TestSendOTPDelegatesToProvider(t *testing.T) {
	provider := &stubEmailProvider{}
	svc := NewService(provider)

	err := svc.SendOTP(context.Background(), "test@example.com", "654321", 5)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if provider.lastTo != "test@example.com" || provider.lastCode != "654321" || provider.lastTTLMinutes != 5 {
		t.Fatalf("provider received unexpected values: %+v", provider)
	}
}
