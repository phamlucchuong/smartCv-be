package server

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v5"
	"smartCv/notification-service/internal/pkg"
)

// authMiddleware reads the forwarded identity headers set by the API Gateway
// (X-User-Id, X-User-Scope) and stores user_id and audience in the Echo context.
func authMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			userID := c.Request().Header.Get("X-User-Id")
			if userID == "" {
				return pkg.JSONError(c, http.StatusUnauthorized, pkg.CodeUnauthorized, "unauthorized")
			}

			scope := c.Request().Header.Get("X-User-Scope")
			c.Set("user_id", userID)
			c.Set("audience", audienceFromScope(scope))
			return next(c)
		}
	}
}

// audienceFromScope maps the gateway-forwarded scope claim to an FCM audience string.
// ROLE_RECRUITER → web-vendor, ROLE_ADMIN → web-admin, anything else → web-user.
func audienceFromScope(scope string) string {
	normalized := strings.ToUpper(scope)
	switch {
	case strings.Contains(normalized, "ROLE_RECRUITER"):
		return "web-vendor"
	case strings.Contains(normalized, "ROLE_ADMIN"):
		return "web-admin"
	default:
		return "web-user"
	}
}
