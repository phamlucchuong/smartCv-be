package notification

import (
	"context"
	"log/slog"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// minimalMockRepo implements Repository with only FCM methods active.
type minimalMockRepo struct {
	savedToken    *FCMToken
	deletedToken  string
	deletedAud    string
	deletedUserID string
	saveErr       error
	deleteErr     error
}

func (m *minimalMockRepo) SaveFCMToken(_ context.Context, tok *FCMToken) error {
	m.savedToken = tok
	return m.saveErr
}
func (m *minimalMockRepo) DeleteFCMTokenByTokenAudienceAndUser(_ context.Context, token, audience, userID string) error {
	m.deletedToken = token
	m.deletedAud = audience
	m.deletedUserID = userID
	return m.deleteErr
}
func (m *minimalMockRepo) CreateNotification(_ context.Context, _ Notification) error { return nil }
func (m *minimalMockRepo) GetNotificationByID(_ context.Context, _ uuid.UUID) (*Notification, error) {
	return nil, nil
}
func (m *minimalMockRepo) GetNotifications(_ context.Context, _ string, _ string, _, _ int) ([]Notification, int64, error) {
	return nil, 0, nil
}
func (m *minimalMockRepo) MarkAsRead(_ context.Context, _ uuid.UUID) error { return nil }
func (m *minimalMockRepo) MarkAsReadForUser(_ context.Context, _ uuid.UUID, _ string) error {
	return nil
}
func (m *minimalMockRepo) MarkAllAsRead(_ context.Context, _ string, _ string) error {
	return nil
}
func (m *minimalMockRepo) GetUnreadCount(_ context.Context, _ string, _ string) (int64, error) {
	return 0, nil
}
func (m *minimalMockRepo) DeleteOlderThanDays(_ context.Context, _ int) (int64, error) {
	return 0, nil
}
func (m *minimalMockRepo) GetFCMTokensByUserIDAndAudience(_ context.Context, _, _ string) ([]FCMToken, error) {
	return nil, nil
}
func (m *minimalMockRepo) DeleteFCMTokenByTokenAndAudience(_ context.Context, _, _ string) error {
	return nil
}
func (m *minimalMockRepo) DeleteNotificationForUser(_ context.Context, _ uuid.UUID, _ string) error {
	return nil
}
func newTestService(repo Repository) *Service {
	return &Service{repo: repo, logger: slog.Default()}
}

func TestSubscribeFCMToken_UsesProvidedAudience(t *testing.T) {
	repo := &minimalMockRepo{}
	svc := newTestService(repo)

	err := svc.SubscribeFCMToken(context.Background(), "user-123", "fcm-token-xyz", "web-vendor")

	require.NoError(t, err)
	require.NotNil(t, repo.savedToken)
	assert.Equal(t, "web-vendor", repo.savedToken.Audience)
	assert.Equal(t, "user-123", repo.savedToken.UserID)
	assert.Equal(t, "fcm-token-xyz", repo.savedToken.Token)
}

func TestSubscribeFCMToken_WebUserAudience(t *testing.T) {
	repo := &minimalMockRepo{}
	svc := newTestService(repo)

	err := svc.SubscribeFCMToken(context.Background(), "user-123", "fcm-token", "web-user")

	require.NoError(t, err)
	assert.Equal(t, "web-user", repo.savedToken.Audience)
}

func TestUnsubscribeFCMToken_CallsRepoWithUserIDScope(t *testing.T) {
	repo := &minimalMockRepo{}
	svc := newTestService(repo)

	err := svc.UnsubscribeFCMToken(context.Background(), "user-456", "fcm-token-abc", "web-vendor")

	require.NoError(t, err)
	assert.Equal(t, "fcm-token-abc", repo.deletedToken)
	assert.Equal(t, "web-vendor", repo.deletedAud)
	assert.Equal(t, "user-456", repo.deletedUserID)
}

func TestUnsubscribeFCMToken_DoesNotUseScopeOfOtherUser(t *testing.T) {
	repo := &minimalMockRepo{}
	svc := newTestService(repo)

	// user A tries to delete user B's token — the repo call includes user A's ID,
	// so the DB WHERE clause will find 0 rows (not user B's token).
	err := svc.UnsubscribeFCMToken(context.Background(), "user-A", "any-token", "web-user")

	require.NoError(t, err)
	assert.Equal(t, "user-A", repo.deletedUserID, "delete must be scoped to the caller's userID")
}
