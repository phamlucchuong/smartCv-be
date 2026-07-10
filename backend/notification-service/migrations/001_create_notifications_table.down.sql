DROP INDEX IF EXISTS uq_notification_fcm_tokens_token_audience;
DROP INDEX IF EXISTS idx_notification_fcm_tokens_user_id_audience;
DROP TABLE IF EXISTS notification_fcm_tokens;

DROP INDEX IF EXISTS idx_notifications_unread;
DROP INDEX IF EXISTS idx_notifications_user_role;
DROP TABLE IF EXISTS notifications;
