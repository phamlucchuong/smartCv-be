package vn.chuongpl.user_service.configuration;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private static final String[] SWAGGER_ENDPOINTS = {
            "/v3/api-docs/**",
            "/swagger-ui/**",
            "/swagger-ui.html",
            "/swagger-resources/**",
            "/webjars/**"
    };

    private final InternalAuthFilter internalAuthFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(internalAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(SWAGGER_ENDPOINTS).permitAll()
                        .requestMatchers(HttpMethod.POST,
                                "/api/auth/register", "/api/auth/verify-registration",
                                "/api/auth/resend-otp", "/api/auth/forgot-password",
                                "/api/auth/reset-password", "/api/auth/login",
                                "/api/auth/google",
                                "/api/auth/introspect", "/api/auth/refresh").permitAll()
                        .requestMatchers(HttpMethod.GET,
                                "/api/users/verify-email/**",
                                "/api/companies",
                                "/api/companies/*",
                                "/api/companies/*/jobs",
                                "/api/companies/*/related",
                                "/api/companies/by-recruiter/*").permitAll()
                        // Internal service-to-service endpoints — protected by InternalAuthFilter (X-Gateway-Secret)
                        .requestMatchers("/api/internal/**").permitAll()
                        .anyRequest().authenticated()
                );
        return http.build();
    }
}
