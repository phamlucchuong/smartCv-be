package otp

import (
	"context"
	"log/slog"
	"net/http"
	"smartCv/notification-service/internal/pkg"

	"github.com/labstack/echo/v5"
)

type OTPService interface {
	SendOTP(ctx context.Context, target string, targetType string, otpType string, ttlMinutes int) error
	VerifyOTP(ctx context.Context, target string, targetType string, otpType string, code string) (bool, error)
}

type Handler struct {
	notiSvc OTPService
	logger  *slog.Logger
}

func NewHandler(notiSvc OTPService, logger *slog.Logger) *Handler {
	return &Handler{
		notiSvc: notiSvc,
		logger:  logger,
	}
}

func (h *Handler) SendOTP(c *echo.Context) error {
	var req SendOTPRequest
	if err := c.Bind(&req); err != nil {
		return pkg.JSONError(c, http.StatusBadRequest, pkg.CodeBadRequest, "invalid request data")
	}

	if h.notiSvc == nil {
		return pkg.JSONError(c, http.StatusInternalServerError, pkg.CodeInternalError, "notification service not initialized")
	}

	ttl := req.TTLMinutes
	if ttl == 0 {
		ttl = DefaultTTLMinutes
	}

	err := h.notiSvc.SendOTP(c.Request().Context(), req.Target, req.TargetType, req.OtpType, ttl)
	if err != nil {
		h.logger.Error("failed to send otp", "target", req.Target, "err", err)
		return pkg.JSONError(c, http.StatusInternalServerError, pkg.CodeInternalError, "failed to send otp")
	}

	return pkg.JSONOK(c, OTPResponse{Message: "OTP sent successfully"})
}

func (h *Handler) VerifyOTP(c *echo.Context) error {
	var req VerifyOTPRequest
	if err := c.Bind(&req); err != nil {
		return pkg.JSONError(c, http.StatusBadRequest, pkg.CodeBadRequest, "invalid request data")
	}

	if h.notiSvc == nil {
		return pkg.JSONError(c, http.StatusInternalServerError, pkg.CodeInternalError, "notification service not initialized")
	}

	isValid, err := h.notiSvc.VerifyOTP(c.Request().Context(), req.Target, req.TargetType, req.OtpType, req.Code)
	if err != nil {
		h.logger.Error("failed to verify otp", "target", req.Target, "err", err)
		return pkg.JSONError(c, http.StatusInternalServerError, pkg.CodeInternalError, "failed to verify otp")
	}

	if !isValid {
		return pkg.JSONError(c, http.StatusUnauthorized, pkg.CodeUnauthorized, "invalid or expired otp")
	}

	return pkg.JSONOK(c, OTPResponse{Message: "OTP verified successfully"})
}
