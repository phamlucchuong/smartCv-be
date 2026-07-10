package notification

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repository interface {
	CreateNotification(ctx context.Context, n Notification) error
	GetNotificationByID(ctx context.Context, id uuid.UUID) (*Notification, error)
	GetNotifications(ctx context.Context, receiverID string, receiverType string, limit, offset int) ([]Notification, int64, error)
	MarkAsRead(ctx context.Context, id uuid.UUID) error
	MarkAsReadForUser(ctx context.Context, id uuid.UUID, userID string) error
	MarkAllAsRead(ctx context.Context, receiverID string, receiverType string) error
	GetUnreadCount(ctx context.Context, receiverID string, receiverType string) (int64, error)
	DeleteOlderThanDays(ctx context.Context, olderThanDays int) (int64, error)
	DeleteNotificationForUser(ctx context.Context, id uuid.UUID, userID string) error

	SaveFCMToken(ctx context.Context, token *FCMToken) error
	GetFCMTokensByUserIDAndAudience(ctx context.Context, userID string, audience string) ([]FCMToken, error)
	// DeleteFCMTokenByTokenAndAudience removes a token by token+audience key (used for stale-token cleanup during FCM send).
	DeleteFCMTokenByTokenAndAudience(ctx context.Context, token string, audience string) error
	// DeleteFCMTokenByTokenAudienceAndUser removes a token scoped to a specific user (user-facing unsubscribe).
	DeleteFCMTokenByTokenAudienceAndUser(ctx context.Context, token string, audience string, userID string) error
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{
		db: db,
	}
}

func (r *repository) CreateNotification(ctx context.Context, n Notification) error {
	return r.db.WithContext(ctx).Create(&n).Error
}

func (r *repository) GetNotificationByID(ctx context.Context, id uuid.UUID) (*Notification, error) {
	var n Notification
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&n).Error; err != nil {
		return nil, err
	}
	return &n, nil
}

func (r *repository) GetNotifications(ctx context.Context, receiverID string, receiverType string, limit, offset int) ([]Notification, int64, error) {
	var notifications []Notification
	var total int64

	db := r.db.WithContext(ctx).Model(&Notification{}).Where("user_id = ? AND recipient_role = ?", receiverID, receiverType)

	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := db.Order("created_at DESC").Limit(limit).Offset(offset).Find(&notifications).Error; err != nil {
		return nil, 0, err
	}

	return notifications, total, nil
}

func (r *repository) MarkAsRead(ctx context.Context, id uuid.UUID) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&Notification{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"is_read": true,
			"read_at": &now,
		}).Error
}

func (r *repository) MarkAsReadForUser(ctx context.Context, id uuid.UUID, userID string) error {
	now := time.Now()
	tx := r.db.WithContext(ctx).Model(&Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Updates(map[string]interface{}{
			"is_read": true,
			"read_at": &now,
		})
	if tx.Error != nil {
		return tx.Error
	}
	if tx.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *repository) MarkAllAsRead(ctx context.Context, receiverID string, receiverType string) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&Notification{}).
		Where("user_id = ? AND recipient_role = ? AND is_read = ?", receiverID, receiverType, false).
		Updates(map[string]interface{}{
			"is_read": true,
			"read_at": &now,
		}).Error
}

func (r *repository) GetUnreadCount(ctx context.Context, receiverID string, receiverType string) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&Notification{}).
		Where("user_id = ? AND recipient_role = ? AND is_read = ?", receiverID, receiverType, false).
		Count(&count).Error
	return count, err
}

func (r *repository) DeleteOlderThanDays(ctx context.Context, olderThanDays int) (int64, error) {
	cutoff := time.Now().AddDate(0, 0, -olderThanDays)

	tx := r.db.WithContext(ctx).
		Where("created_at < ?", cutoff).
		Delete(&Notification{})

	return tx.RowsAffected, tx.Error
}

func (r *repository) DeleteNotificationForUser(ctx context.Context, id uuid.UUID, userID string) error {
	tx := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		Delete(&Notification{})
	if tx.Error != nil {
		return tx.Error
	}
	if tx.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *repository) SaveFCMToken(ctx context.Context, token *FCMToken) error {
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns: []clause.Column{
				{Name: "token"},
				{Name: "audience"},
			},
			DoUpdates: clause.AssignmentColumns([]string{"user_id", "updated_at"}),
		}).
		Create(token).Error
}

func (r *repository) GetFCMTokensByUserIDAndAudience(ctx context.Context, userID string, audience string) ([]FCMToken, error) {
	var tokens []FCMToken
	err := r.db.WithContext(ctx).Where("user_id = ? AND audience = ?", userID, audience).Find(&tokens).Error
	return tokens, err
}

func (r *repository) DeleteFCMTokenByTokenAndAudience(ctx context.Context, token string, audience string) error {
	return r.db.WithContext(ctx).Where("token = ? AND audience = ?", token, audience).Delete(&FCMToken{}).Error
}

func (r *repository) DeleteFCMTokenByTokenAudienceAndUser(ctx context.Context, token string, audience string, userID string) error {
	return r.db.WithContext(ctx).Where("token = ? AND audience = ? AND user_id = ?", token, audience, userID).Delete(&FCMToken{}).Error
}
