package server

import (
	"testing"

	"smartCv/notification-service/internal/config"
)

func TestResolveSMSProviderPrefersTwilioWhenAWSAuthIsMissing(t *testing.T) {
	cfg := &config.Config{
		SMSProvider:      "aws_sns",
		AWSRegion:        "ap-southeast-1",
		TwilioAccountSID: "sid",
		TwilioAuthToken:  "token",
		TwilioFromNumber: "+15551234567",
	}

	provider := resolveSMSProvider(cfg, func(string) string { return "" })
	if provider != smsProviderTwilio {
		t.Fatalf("expected twilio fallback, got %q", provider)
	}
}

func TestResolveSMSProviderUsesSNSWhenAWSAuthHintsExist(t *testing.T) {
	cfg := &config.Config{
		SMSProvider: "aws_sns",
		AWSRegion:   "ap-southeast-1",
	}

	provider := resolveSMSProvider(cfg, func(key string) string {
		if key == "AWS_ACCESS_KEY_ID" {
			return "access-key"
		}
		return ""
	})
	if provider != smsProviderSNS {
		t.Fatalf("expected aws_sns, got %q", provider)
	}
}
