package otp

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"time"

	"github.com/redis/go-redis/v9"
)

type Service interface {
	GenerateOTP(ctx context.Context, target string, targetType string, otpType string, ttlMinutes int) (string, error)
	VerifyOTP(ctx context.Context, target string, targetType string, otpType string, code string) (bool, error)
}

type otpService struct {
	redis         *redis.Client
	codeGenerator func(length int) (string, error)
}

func NewService(redisClient *redis.Client) Service {
	return &otpService{
		redis:         redisClient,
		codeGenerator: generateRandomCode,
	}
}

func (s *otpService) GenerateOTP(ctx context.Context, target string, targetType string, otpType string, ttlMinutes int) (string, error) {
	code, err := s.codeGenerator(6)
	if err != nil {
		return "", err
	}

	key := s.getRedisKey(target, targetType, otpType)
	err = s.redis.Set(ctx, key, code, time.Duration(ttlMinutes)*time.Minute).Err()
	if err != nil {
		return "", fmt.Errorf("failed to store otp in redis: %w", err)
	}

	return code, nil
}

func (s *otpService) VerifyOTP(ctx context.Context, target string, targetType string, otpType string, code string) (bool, error) {
	key := s.getRedisKey(target, targetType, otpType)
	storedCode, err := s.redis.Get(ctx, key).Result()
	if err == redis.Nil {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to get otp from redis: %w", err)
	}

	if storedCode == code {
		s.redis.Del(ctx, key)
		return true, nil
	}

	return false, nil
}

func (s *otpService) getRedisKey(target string, targetType string, otpType string) string {
	if otpType == "" {
		otpType = "VERIFY_ACCOUNT"
	}
	return fmt.Sprintf("otp:%s:%s:%s", otpType, targetType, target)
}

func generateRandomCode(length int) (string, error) {
	const digits = "0123456789"
	result := make([]byte, length)
	for i := 0; i < length; i++ {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(digits))))
		if err != nil {
			return "", err
		}
		result[i] = digits[num.Int64()]
	}
	return string(result), nil
}
