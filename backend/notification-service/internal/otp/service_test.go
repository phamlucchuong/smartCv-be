package otp

import (
	"context"
	"testing"
	"time"

	"github.com/go-redis/redismock/v9"
	"github.com/stretchr/testify/assert"
)

func TestGenerateOTP(t *testing.T) {
	db, mock := redismock.NewClientMock()
	// Create service directly to inject mock generator
	svc := &otpService{
		redis:         db,
		codeGenerator: func(length int) (string, error) { return "123456", nil },
	}
	ctx := context.Background()

	target := "test@example.com"
	targetType := "EMAIL"
	ttl := 5
	code := "123456"

	mock.ExpectSet("otp:VERIFY_ACCOUNT:EMAIL:test@example.com", code, time.Duration(ttl)*time.Minute).SetVal("OK")

	generatedCode, err := svc.GenerateOTP(ctx, target, targetType, "VERIFY_ACCOUNT", ttl)
	assert.NoError(t, err)
	assert.Equal(t, code, generatedCode)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestVerifyOTP_Success(t *testing.T) {
	db, mock := redismock.NewClientMock()
	svc := NewService(db)
	ctx := context.Background()

	target := "test@example.com"
	targetType := "EMAIL"
	code := "123456"

	mock.ExpectGet("otp:VERIFY_ACCOUNT:EMAIL:test@example.com").SetVal(code)
	mock.ExpectDel("otp:VERIFY_ACCOUNT:EMAIL:test@example.com").SetVal(1)

	isValid, err := svc.VerifyOTP(ctx, target, targetType, "VERIFY_ACCOUNT", code)
	assert.NoError(t, err)
	assert.True(t, isValid)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestVerifyOTP_WrongCode(t *testing.T) {
	db, mock := redismock.NewClientMock()
	svc := NewService(db)
	ctx := context.Background()

	target := "test@example.com"
	targetType := "EMAIL"
	storedCode := "123456"
	wrongCode := "654321"

	mock.ExpectGet("otp:VERIFY_ACCOUNT:EMAIL:test@example.com").SetVal(storedCode)

	isValid, err := svc.VerifyOTP(ctx, target, targetType, "VERIFY_ACCOUNT", wrongCode)
	assert.NoError(t, err)
	assert.False(t, isValid)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestVerifyOTP_Expired(t *testing.T) {
	db, mock := redismock.NewClientMock()
	svc := NewService(db)
	ctx := context.Background()

	target := "test@example.com"
	targetType := "EMAIL"
	code := "123456"

	mock.ExpectGet("otp:VERIFY_ACCOUNT:EMAIL:test@example.com").RedisNil()

	isValid, err := svc.VerifyOTP(ctx, target, targetType, "VERIFY_ACCOUNT", code)
	assert.NoError(t, err)
	assert.False(t, isValid)
	assert.NoError(t, mock.ExpectationsWereMet())
}
