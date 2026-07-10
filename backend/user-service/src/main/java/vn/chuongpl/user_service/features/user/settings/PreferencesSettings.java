package vn.chuongpl.user_service.features.user.settings;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class PreferencesSettings {
    @Builder.Default PreferenceLanguage language = PreferenceLanguage.VI;
    @Builder.Default PreferenceTheme theme = PreferenceTheme.LIGHT;
}
