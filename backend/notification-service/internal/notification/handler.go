package notification

import (
	"log/slog"
	"net/http"
	"smartCv/notification-service/internal/pkg"
	"strconv"
	"time"

	"github.com/labstack/echo/v5"
)

// Handler handles notification-related HTTP requests.
type Handler struct {
	notifSvc ServiceInterface
	logger   *slog.Logger
}

// NewHandler creates a new notification handler.
func NewHandler(notifSvc ServiceInterface, logger *slog.Logger) *Handler {
	return &Handler{
		notifSvc: notifSvc,
		logger:   logger,
	}
}

func (h *Handler) ListNotifications(c *echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	if userID == "" {
		return pkg.JSONError(c, http.StatusUnauthorized, pkg.CodeUnauthorized, "unauthorized")
	}

	audience, _ := c.Get("audience").(string)
	receiverType := mapAudienceToRole(audience)

	page, _ := strconv.Atoi(c.QueryParam("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.QueryParam("pageSize"))
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	notifs, total, err := h.notifSvc.GetNotificationsHistory(c.Request().Context(), userID, receiverType, page, pageSize)
	if err != nil {
		return pkg.JSONError(c, http.StatusInternalServerError, pkg.CodeInternalError, "failed to fetch notifications")
	}

	unreadCount, _ := h.notifSvc.GetUnreadCount(c.Request().Context(), userID, receiverType)

	items := make([]NotificationResponse, len(notifs))
	for i, n := range notifs {
		items[i] = NotificationResponse{
			ID:            n.ID.String(),
			ReceiverID:    n.UserID,
			RecipientRole: n.RecipientRole,
			Type:          n.Type,
			Title:         n.Title,
			Body:          n.Body,
			Data:          n.Data,
			IsRead:        n.IsRead,
			CreatedAt:     n.CreatedAt.Format(time.RFC3339),
		}
		if n.ReadAt != nil {
			at := n.ReadAt.Format(time.RFC3339)
			items[i].ReadAt = &at
		}
	}

	resp := ListNotificationsResponse{
		Data:        items,
		UnreadCount: unreadCount,
		Meta: pkg.PaginationMeta{
			Page:       page,
			PageSize:   pageSize,
			TotalItems: int(total),
			TotalPages: int((total + int64(pageSize) - 1) / int64(pageSize)),
		},
	}

	return pkg.JSONOK(c, resp)
}

func (h *Handler) MarkRead(c *echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	if userID == "" {
		return pkg.JSONError(c, http.StatusUnauthorized, pkg.CodeUnauthorized, "unauthorized")
	}

	id := c.Param("id")
	if id == "" {
		return pkg.JSONError(c, http.StatusBadRequest, pkg.CodeBadRequest, "notification id is required")
	}

	if err := h.notifSvc.MarkAsReadForUser(c.Request().Context(), id, userID); err != nil {
		return pkg.JSONError(c, http.StatusInternalServerError, pkg.CodeInternalError, "failed to mark notification as read")
	}

	return pkg.JSONOK(c, nil)
}

func (h *Handler) MarkAllRead(c *echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	if userID == "" {
		return pkg.JSONError(c, http.StatusUnauthorized, pkg.CodeUnauthorized, "unauthorized")
	}

	audience, _ := c.Get("audience").(string)
	receiverType := mapAudienceToRole(audience)

	if err := h.notifSvc.MarkAllAsRead(c.Request().Context(), userID, receiverType); err != nil {
		return pkg.JSONError(c, http.StatusInternalServerError, pkg.CodeInternalError, "failed to mark notifications as read")
	}

	return pkg.JSONOK(c, nil)
}

func mapAudienceToRole(audience string) string {
	switch audience {
	case "web-vendor":
		return "RECRUITER"
	case "web-admin":
		return "ADMIN"
	case "web-recruiter":
		return "RECRUITER"
	default:
		return "USER"
	}
}

// SubscribeFCMToken handles POST /api/v1/notifications/fcm/subscribe
func (h *Handler) SubscribeFCMToken(c *echo.Context) error {
	userID, ok := c.Get("user_id").(string)
	if !ok || userID == "" {
		return pkg.JSONError(c, http.StatusUnauthorized, pkg.CodeUnauthorized, "unauthorized")
	}

	var req FCMSubscribeRequest
	if err := c.Bind(&req); err != nil {
		return pkg.JSONError(c, http.StatusBadRequest, pkg.CodeBadRequest, "invalid subscription data")
	}

	if req.Token == "" {
		return pkg.JSONError(c, http.StatusBadRequest, pkg.CodeBadRequest, "missing token")
	}

	// Always derive audience from the middleware context (set from X-User-Scope by the gateway).
	// Never trust the client-supplied req.Audience — it could be forged to store tokens under another audience.
	audience, _ := c.Get("audience").(string)
	if audience == "" {
		audience = "web-user"
	}
	if err := h.notifSvc.SubscribeFCMToken(c.Request().Context(), userID, req.Token, audience); err != nil {
		h.logger.Error("failed to save fcm token", "userID", userID, "err", err)
		return pkg.JSONError(c, http.StatusInternalServerError, pkg.CodeInternalError, "failed to save token")
	}

	return pkg.JSONOK(c, nil)
}

// UnsubscribeFCMToken handles DELETE /api/v1/notifications/fcm/unsubscribe
func (h *Handler) UnsubscribeFCMToken(c *echo.Context) error {
	userID, ok := c.Get("user_id").(string)
	if !ok || userID == "" {
		return pkg.JSONError(c, http.StatusUnauthorized, pkg.CodeUnauthorized, "unauthorized")
	}

	var req FCMSubscribeRequest
	if err := c.Bind(&req); err != nil {
		return pkg.JSONError(c, http.StatusBadRequest, pkg.CodeBadRequest, "invalid request data")
	}

	if req.Token == "" {
		return pkg.JSONError(c, http.StatusBadRequest, pkg.CodeBadRequest, "missing token")
	}

	audience, _ := c.Get("audience").(string)
	if audience == "" {
		audience = "web-user"
	}
	if err := h.notifSvc.UnsubscribeFCMToken(c.Request().Context(), userID, req.Token, audience); err != nil {
		h.logger.Error("failed to remove fcm token", "userID", userID, "err", err)
		return pkg.JSONError(c, http.StatusInternalServerError, pkg.CodeInternalError, "failed to remove token")
	}

	return pkg.JSONOK(c, nil)
}

// GetFirebaseToken generates a Firebase custom token for the authenticated user.
// GET /api/v1/notifications/firebase-token
func (h *Handler) GetFirebaseToken(c *echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	if userID == "" {
		return pkg.JSONError(c, http.StatusUnauthorized, pkg.CodeUnauthorized, "unauthorized")
	}
	token, err := h.notifSvc.GenerateFirebaseToken(c.Request().Context(), userID)
	if err != nil {
		h.logger.Error("failed to generate firebase token", "userID", userID, "err", err)
		return pkg.JSONError(c, http.StatusInternalServerError, pkg.CodeInternalError, "firebase token generation failed")
	}
	return pkg.JSONOK(c, map[string]string{"firebaseToken": token})
}

func (h *Handler) DeleteNotification(c *echo.Context) error {
	userID, _ := c.Get("user_id").(string)
	if userID == "" {
		return pkg.JSONError(c, http.StatusUnauthorized, pkg.CodeUnauthorized, "unauthorized")
	}

	id := c.Param("id")
	if id == "" {
		return pkg.JSONError(c, http.StatusBadRequest, pkg.CodeBadRequest, "notification id is required")
	}

	if err := h.notifSvc.DeleteNotificationForUser(c.Request().Context(), id, userID); err != nil {
		return pkg.JSONError(c, http.StatusInternalServerError, pkg.CodeInternalError, "failed to delete notification")
	}

	return pkg.JSONOK(c, nil)
}
