package vn.chuongpl.api_gateway.configuration;

import org.junit.jupiter.api.Test;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PublicRoutesMatcherTest {

    @Test
    void isPublic_shouldMatchMethodAndWildcardPath() {
        PublicRoutesMatcher.PublicRoute route = new PublicRoutesMatcher.PublicRoute();
        route.setMethod("GET");
        route.setPath("/job/api/jobs/*");

        PublicRoutesMatcher matcher = new PublicRoutesMatcher();
        matcher.setPublicRoutes(List.of(route));

        boolean actual = matcher.isPublic(MockServerWebExchange.from(
                MockServerHttpRequest.get("/job/api/jobs/123").build()
        ));

        assertTrue(actual);
    }

    @Test
    void isPublic_shouldReturnFalseWhenMethodDoesNotMatch() {
        PublicRoutesMatcher.PublicRoute route = new PublicRoutesMatcher.PublicRoute();
        route.setMethod("POST");
        route.setPath("/user/api/auth/login");

        PublicRoutesMatcher matcher = new PublicRoutesMatcher();
        matcher.setPublicRoutes(List.of(route));

        boolean actual = matcher.isPublic(MockServerWebExchange.from(
                MockServerHttpRequest.get("/user/api/auth/login").build()
        ));

        assertFalse(actual);
    }

    @Test
    void isPublic_shouldNotTreatRecruiterOwnJobsEndpointAsPublic() {
        PublicRoutesMatcher.PublicRoute route = new PublicRoutesMatcher.PublicRoute();
        route.setMethod("GET");
        route.setPath("/job/api/jobs/*");

        PublicRoutesMatcher matcher = new PublicRoutesMatcher();
        matcher.setPublicRoutes(List.of(route));

        boolean actual = matcher.isPublic(MockServerWebExchange.from(
                MockServerHttpRequest.get("/job/api/jobs/my").build()
        ));

        assertFalse(actual);
    }
}
