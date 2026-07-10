package vn.chuongpl.user_service.features.candidate.settings;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CandidateSettings {
    @Builder.Default NotificationPreferences notifications = new NotificationPreferences();
    @Builder.Default PrivacySettings privacy = new PrivacySettings();
    @Builder.Default PreferencesSettings preferences = new PreferencesSettings();
}
