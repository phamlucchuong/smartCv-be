package vn.chuongpl.payment_service.config;

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

@Component
public class InternalAuthFilter extends OncePerRequestFilter {

    @Value("${app.gateway.internal-secret}")
    private String expectedSecret;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String servletPath = request.getServletPath();
        String requestUri = request.getRequestURI();
        return servletPath.startsWith("/api/webhook/payos")
                || requestUri.startsWith("/payment/api/webhook/payos")
                || servletPath.startsWith("/v3/api-docs")
                || servletPath.startsWith("/swagger-ui")
                || servletPath.startsWith("/actuator");
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

        if (userId != null && !userId.isBlank()) {
            List<GrantedAuthority> authorities = Collections.emptyList();
            if (scope != null && !scope.isBlank()) {
                authorities = Arrays.stream(scope.split(" "))
                        .map(SimpleGrantedAuthority::new)
                        .collect(Collectors.toList());
            }
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(userId, null, authorities));
        }

        chain.doFilter(request, response);
    }
}
