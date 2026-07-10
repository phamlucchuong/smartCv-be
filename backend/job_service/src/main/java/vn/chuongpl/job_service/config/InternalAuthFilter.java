package vn.chuongpl.job_service.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class InternalAuthFilter extends OncePerRequestFilter {

    @Value("${app.gateway.internal-secret}")
    private String expectedSecret;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return path.startsWith("/v3/api-docs") || path.startsWith("/swagger-ui") || path.startsWith("/swagger-resources") || path.startsWith("/webjars");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String secret = request.getHeader("X-Gateway-Secret");
        if (!expectedSecret.equals(secret)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("Direct access not allowed");
            return;
        }

        String userId = request.getHeader("X-User-Id");
        String scope = request.getHeader("X-User-Scope");
        log.info("[Auth] {} {} | userId={} scope={}", request.getMethod(), request.getServletPath(), userId, scope);

        if (userId != null && !userId.isBlank()) {
            List<GrantedAuthority> authorities = Collections.emptyList();
            if (scope != null && !scope.isBlank()) {
                authorities = Arrays.stream(scope.split(" "))
                        .map(SimpleGrantedAuthority::new)
                        .collect(Collectors.toList());
            }
            log.info("[Auth] authorities={}", authorities);
            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(userId, null, authorities);
            SecurityContextHolder.getContext().setAuthentication(auth);
        }

        chain.doFilter(request, response);
    }
}
