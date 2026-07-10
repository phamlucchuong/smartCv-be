CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    recipient_role varchar(20) NOT NULL,
    type varchar(50) NOT NULL DEFAULT 'SYSTEM',
    title varchar(200) NOT NULL,
    body text NOT NULL,
    data jsonb,
    is_read boolean NOT NULL DEFAULT false,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_role
    ON notifications (user_id, recipient_role);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
    ON notifications (user_id, recipient_role, created_at DESC)
    WHERE is_read = false;

CREATE TABLE IF NOT EXISTS notification_fcm_tokens (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    audience varchar(20) NOT NULL DEFAULT 'web-user',
    token text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_fcm_tokens_user_id_audience
    ON notification_fcm_tokens (user_id, audience);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_fcm_tokens_token_audience
    ON notification_fcm_tokens (token, audience);
