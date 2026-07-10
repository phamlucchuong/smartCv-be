package email

import "testing"

func TestNewServiceParsesSMTPFromWithDisplayName(t *testing.T) {
	svc := NewService(
		"smtp.gmail.com",
		"587",
		"mailer@example.com",
		"secret",
		"Smart CV <noreply@smartcv.com>",
		"",
	)

	if svc == nil {
		t.Fatal("expected service to be created")
	}

	if svc.fromMail != "noreply@smartcv.com" {
		t.Fatalf("expected parsed fromMail, got %q", svc.fromMail)
	}

	if svc.fromName != "Smart CV" {
		t.Fatalf("expected parsed fromName, got %q", svc.fromName)
	}
}
