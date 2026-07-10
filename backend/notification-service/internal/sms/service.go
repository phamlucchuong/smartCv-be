package sms

import "context"

type SMSProvider interface {
	SendOTP(ctx context.Context, to string, code string, ttlMinutes int) error
}

type Service interface {
	SendOTP(ctx context.Context, to string, code string, ttlMinutes int) error
}

type smsService struct {
	provider SMSProvider
}

func NewService(provider SMSProvider) Service {
	return &smsService{provider: provider}
}

func (s *smsService) SendOTP(ctx context.Context, to string, code string, ttlMinutes int) error {
	if s.provider == nil {
		return ErrProviderNotConfigured
	}
	return s.provider.SendOTP(ctx, to, code, ttlMinutes)
}
