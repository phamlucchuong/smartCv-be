ALTER TABLE notifications ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE notification_fcm_tokens ALTER COLUMN user_id TYPE text USING user_id::text;
