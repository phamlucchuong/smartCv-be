ALTER TABLE notifications ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE notification_fcm_tokens ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
