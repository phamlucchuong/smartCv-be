package notification

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/datatypes"
)

// --- mock repository ---

type mockRepository struct {
	createCalls []Notification
	unreadCount int64
	fcmTokens   []FCMToken
}

func (m *mockRepository) CreateNotification(_ context.Context, n Notification) error {
	m.createCalls = append(m.createCalls, n)
	return nil
}

func (m *mockRepository) GetNotificationByID(_ context.Context, _ uuid.UUID) (*Notification, error) {
	return nil, nil
}

func (m *mockRepository) GetNotifications(_ context.Context, _ string, _ string, _, _ int) ([]Notification, int64, error) {
	return nil, 0, nil
}

func (m *mockRepository) MarkAsRead(_ context.Context, _ uuid.UUID) error { return nil }

func (m *mockRepository) MarkAsReadForUser(_ context.Context, _ uuid.UUID, _ string) error {
	return nil
}

func (m *mockRepository) MarkAllAsRead(_ context.Context, _ string, _ string) error { return nil }

func (m *mockRepository) GetUnreadCount(_ context.Context, _ string, _ string) (int64, error) {
	return m.unreadCount, nil
}

func (m *mockRepository) DeleteOlderThanDays(_ context.Context, _ int) (int64, error) { return 0, nil }

func (m *mockRepository) SaveFCMToken(_ context.Context, _ *FCMToken) error { return nil }

func (m *mockRepository) GetFCMTokensByUserIDAndAudience(_ context.Context, _ string, _ string) ([]FCMToken, error) {
	return m.fcmTokens, nil
}

func (m *mockRepository) DeleteFCMTokenByTokenAndAudience(_ context.Context, _ string, _ string) error {
	return nil
}

func (m *mockRepository) DeleteFCMTokenByTokenAudienceAndUser(_ context.Context, _ string, _ string, _ string) error {
	return nil
}

func (m *mockRepository) DeleteNotificationForUser(_ context.Context, _ uuid.UUID, _ string) error {
	return nil
}

// --- helpers ---

func parseDataMap(t *testing.T, data datatypes.JSON) map[string]string {
	t.Helper()
	var m map[string]string
	require.NoError(t, json.Unmarshal(data, &m))
	return m
}

// --- TestNotifyNewApplicant ---

func TestNotifyNewApplicant_CreatesDBRecord(t *testing.T) {
	repo := &mockRepository{}
	svc := newTestService(repo)

	recruiterID := uuid.New().String()
	recruiterUserID := uuid.New().String()
	applicationID := uuid.New().String()
	jobTitle := "Software Engineer"
	jobID := uuid.New().String()

	svc.NotifyNewApplicant(context.Background(), recruiterID, recruiterUserID, applicationID, jobTitle, jobID)

	require.Len(t, repo.createCalls, 1, "expected exactly one notification created")

	n := repo.createCalls[0]
	assert.Equal(t, recruiterUserID, n.UserID, "notification must be stored under the recruiter's User._id")
	assert.Equal(t, "RECRUITER", n.RecipientRole)
	assert.Equal(t, "NEW_APPLICANT", n.Type)

	dataMap := parseDataMap(t, n.Data)
	assert.Equal(t, "NEW_APPLICANT", dataMap["type"])
	assert.Equal(t, applicationID, dataMap["applicationId"])
	assert.Equal(t, jobID, dataMap["jobId"])
	assert.Equal(t, jobTitle, dataMap["jobTitle"])
	assert.NotEmpty(t, dataMap["url"], "data map must contain a url key")
}

func TestNotifyNewApplicant_SkipsWhenRecruiterIDEmpty(t *testing.T) {
	repo := &mockRepository{}
	svc := newTestService(repo)

	svc.NotifyNewApplicant(context.Background(), "", "", uuid.New().String(), "Engineer", uuid.New().String())

	assert.Empty(t, repo.createCalls, "no notification should be created when both recruiterID and recruiterUserID are empty")
}

// --- TestNotifyAdminNewRecruiterRequest ---

func TestNotifyAdminNewRecruiterRequest_CreatesDBRecordForEachAdmin(t *testing.T) {
	repo := &mockRepository{}
	svc := newTestService(repo)

	adminID1 := uuid.New().String()
	adminID2 := uuid.New().String()
	recruiterID := uuid.New().String()

	msg := RecruiterPendingEventMessage{
		RecruiterID:  recruiterID,
		CompanyName:  "Acme Corp",
		AdminUserIDs: []string{adminID1, adminID2},
		OccurredAt:   "2026-06-21T00:00:00Z",
	}

	svc.NotifyAdminNewRecruiterRequest(context.Background(), msg)

	require.Len(t, repo.createCalls, 2, "expected one notification per admin")

	receiverIDs := []string{
		repo.createCalls[0].UserID,
		repo.createCalls[1].UserID,
	}
	assert.Contains(t, receiverIDs, adminID1)
	assert.Contains(t, receiverIDs, adminID2)

	for _, n := range repo.createCalls {
		assert.Equal(t, "ADMIN", n.RecipientRole)
		assert.Equal(t, "RECRUITER_PENDING", n.Type)

		dataMap := parseDataMap(t, n.Data)
		assert.Equal(t, "RECRUITER_PENDING", dataMap["type"])
		assert.Equal(t, recruiterID, dataMap["recruiterId"])
		assert.Equal(t, "Acme Corp", dataMap["companyName"])
		assert.NotEmpty(t, dataMap["url"], "data map must contain a url key")
	}
}

func TestNotifyAdminNewRecruiterRequest_SkipsWhenNoAdmins(t *testing.T) {
	repo := &mockRepository{}
	svc := newTestService(repo)

	msg := RecruiterPendingEventMessage{
		RecruiterID:  uuid.New().String(),
		CompanyName:  "Acme Corp",
		AdminUserIDs: []string{},
	}

	svc.NotifyAdminNewRecruiterRequest(context.Background(), msg)

	assert.Empty(t, repo.createCalls, "no notifications should be created when AdminUserIDs is empty")
}
