package server

import (
	"net/http"

	"github.com/labstack/echo/v5"
)

func (s *Server) setupRoutes() {
	s.echo.GET("/health", s.healthCheck)

	v1 := s.echo.Group("/notification/api")

	// OTP Routes
	otp := v1.Group("/otp")
	otp.POST("/send", s.otpHandler.SendOTP)
	otp.POST("/verify", s.otpHandler.VerifyOTP)

	// Notification Routes
	notifications := v1.Group("/notifications", authMiddleware())
	notifications.GET("", s.notiHandler.ListNotifications)
	notifications.PATCH("/:id/read", s.notiHandler.MarkRead)
	notifications.DELETE("/:id", s.notiHandler.DeleteNotification)
	notifications.POST("/read-all", s.notiHandler.MarkAllRead)
	notifications.GET("/firebase-token", s.notiHandler.GetFirebaseToken)
	notifications.POST("/fcm/subscribe", s.notiHandler.SubscribeFCMToken)
	notifications.DELETE("/fcm/unsubscribe", s.notiHandler.UnsubscribeFCMToken)
}

func (s *Server) healthCheck(c *echo.Context) error {
	ctx := c.Request().Context()

	sqlDB, err := s.db.DB()
	if err != nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"status":   "unhealthy",
			"database": err.Error(),
		})
	}
	if err := sqlDB.PingContext(ctx); err != nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"status":   "unhealthy",
			"database": err.Error(),
		})
	}

	if err := s.rdb.Ping(ctx).Err(); err != nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"status": "unhealthy",
			"redis":  err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"status": "healthy",
	})
}
