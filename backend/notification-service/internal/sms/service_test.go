package sms

import (
	"context"
	"errors"
	"testing"
)

type stubProvider struct {
	err       error
	lastTo    string
	lastCode  string
	lastTTL   int
	callCount int
}

func (s *stubProvider) SendOTP(_ context.Context, to string, code string, ttlMinutes int) error {
	s.callCount++
	s.lastTo = to
	s.lastCode = code
	s.lastTTL = ttlMinutes
	return s.err
}

func TestSendOTPReturnsProviderNotConfiguredWhenProviderIsNil(t *testing.T) {
	svc := NewService(nil)

	err := svc.SendOTP(context.Background(), "0987654321", "123456", 5)

	if !errors.Is(err, ErrProviderNotConfigured) {
		t.Fatalf("expected ErrProviderNotConfigured, got %v", err)
	}
}

func TestSendOTPDelegatesToProvider(t *testing.T) {
	provider := &stubProvider{}
	svc := NewService(provider)

	err := svc.SendOTP(context.Background(), "0987654321", "654321", 10)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}

	if provider.callCount != 1 {
		t.Fatalf("expected provider to be called once, got %d", provider.callCount)
	}
	if provider.lastTo != "0987654321" || provider.lastCode != "654321" || provider.lastTTL != 10 {
		t.Fatalf("unexpected provider args: to=%s code=%s ttl=%d", provider.lastTo, provider.lastCode, provider.lastTTL)
	}
}
