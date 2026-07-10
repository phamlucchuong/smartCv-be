package vn.chuongpl.user_service.features.user.settings;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PreferencesSettingsRequest {
    PreferenceLanguage language;
    PreferenceTheme theme;
}
