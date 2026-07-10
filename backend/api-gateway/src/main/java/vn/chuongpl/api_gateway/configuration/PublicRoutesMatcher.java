package vn.chuongpl.api_gateway.configuration;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.server.ServerWebExchange;

import java.util.ArrayList;
import java.util.List;

@Data
@Configuration
@ConfigurationProperties(prefix = "app")
public class PublicRoutesMatcher {
    private final AntPathMatcher antPathMatcher = new AntPathMatcher();
    private List<PublicRoute> publicRoutes = new ArrayList<>();

    public boolean isPublic(ServerWebExchange exchange) {
        String path = exchange.getRequest().getPath().value();
        HttpMethod method = exchange.getRequest().getMethod();
        if (method == null) return false;
        return publicRoutes.stream().anyMatch(r -> r.matches(method, path, antPathMatcher));
    }

    @Data
    public static class PublicRoute {
        private String method;
        private String path;

        public boolean matches(HttpMethod m, String p, AntPathMatcher matcher) {
            if (isProtectedJobRoute(p)) {
                return false;
            }
            return m.name().equalsIgnoreCase(method) && matcher.match(path, p);
        }

        private boolean isProtectedJobRoute(String path) {
            return "/job/api/jobs/my".equals(path);
        }
    }
}
