package notification

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type Notification struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID        string         `json:"receiverId" gorm:"column:user_id;type:text;not null;index:idx_notifications_user_role"`
	RecipientRole string         `json:"receiverType" gorm:"column:recipient_role;type:varchar(20);not null;index:idx_notifications_user_role"`
	Type          string         `json:"type" gorm:"type:varchar(50);default:'SYSTEM'"`
	Title         string         `json:"title" gorm:"type:varchar(200);not null"`
	Body          string         `json:"body" gorm:"type:text;not null"`
	Data          datatypes.JSON `json:"data" gorm:"type:jsonb"`
	IsRead        bool           `json:"isRead" gorm:"column:is_read;default:false;index:idx_notifications_unread,where:is_read = false"`
	ReadAt        *time.Time     `json:"readAt,omitempty" gorm:"column:read_at"`
	CreatedAt     time.Time      `json:"createdAt" gorm:"default:CURRENT_TIMESTAMP"`
}

func (Notification) TableName() string {
	return "notifications"
}

// FCMToken represents a Firebase Cloud Messaging registration token stored in the database.
type FCMToken struct {
	ID        string    `gorm:"type:uuid;primaryKey" json:"id"`
	UserID    string    `gorm:"type:text;not null;index:idx_notification_fcm_tokens_user_id_audience" json:"userId"`
	Audience  string    `gorm:"type:varchar(20);not null;default:'web-user';index:idx_notification_fcm_tokens_user_id_audience;uniqueIndex:uq_notification_fcm_tokens_token_audience" json:"audience"`
	Token     string    `gorm:"type:text;not null;uniqueIndex:uq_notification_fcm_tokens_token_audience" json:"token"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (FCMToken) TableName() string {
	return "notification_fcm_tokens"
}

// FCMSubscribeRequest matches the JSON structure sent by the browser client.
type FCMSubscribeRequest struct {
	Token    string `json:"token"`
	Audience string `json:"audience"`
}

func NewFCMToken(userID, token, audience string) FCMToken {
	return FCMToken{
		ID:       uuid.Must(uuid.NewV7()).String(),
		UserID:   userID,
		Audience: audience,
		Token:    token,
	}
}
