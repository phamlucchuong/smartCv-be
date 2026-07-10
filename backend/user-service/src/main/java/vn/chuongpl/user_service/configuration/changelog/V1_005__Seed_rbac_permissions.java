package vn.chuongpl.user_service.configuration.changelog;

import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import vn.chuongpl.user_service.features.permission.Permission;
import vn.chuongpl.user_service.features.role.Role;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@ChangeUnit(id = "V1_005__Seed_rbac_permissions", order = "005", author = "codex")
public class V1_005__Seed_rbac_permissions {

    private static final Map<String, List<String>> RESOURCE_ACTIONS = new LinkedHashMap<>();

    static {
        RESOURCE_ACTIONS.put("user", List.of("create", "read", "update", "delete"));
        RESOURCE_ACTIONS.put("employer_verification", List.of("create", "read", "update", "delete", "verify"));
        RESOURCE_ACTIONS.put("job", List.of("create", "read", "update", "delete", "approve"));
        RESOURCE_ACTIONS.put("cv", List.of("create", "read", "update", "delete", "upload", "download", "export"));
        RESOURCE_ACTIONS.put("package", List.of("create", "read", "update", "delete"));
        RESOURCE_ACTIONS.put("payment", List.of("create", "read", "update", "delete", "refund", "export"));
        RESOURCE_ACTIONS.put("ai_config", List.of("create", "read", "update", "delete"));
        RESOURCE_ACTIONS.put("system_setting", List.of("create", "read", "update", "delete"));
        RESOURCE_ACTIONS.put("audit_log", List.of("create", "read", "update", "delete", "export"));
    }

    @Execution
    public void execute(MongoTemplate mongoTemplate) {
        Map<String, Permission> permissionsByName = upsertPermissions(mongoTemplate);
        updateRolePermissions(mongoTemplate, "ADMIN", permissionsByName.keySet());
        updateRolePermissions(mongoTemplate, "RECRUITER", Set.of(
                "employer_verification.read",
                "job.create", "job.read", "job.update",
                "cv.read", "cv.download",
                "package.read",
                "payment.read"
        ));
        updateRolePermissions(mongoTemplate, "CANDIDATE", Set.of(
                "user.read", "user.update",
                "job.read",
                "cv.create", "cv.read", "cv.update", "cv.upload", "cv.download",
                "package.read",
                "payment.read"
        ));
    }

    @RollbackExecution
    public void rollback(MongoTemplate mongoTemplate) {
        Set<String> permissionNames = RESOURCE_ACTIONS.entrySet().stream()
                .flatMap(entry -> entry.getValue().stream().map(action -> entry.getKey() + "." + action))
                .collect(Collectors.toSet());

        mongoTemplate.remove(Query.query(Criteria.where("_id").in(permissionNames)), Permission.class);
    }

    private Map<String, Permission> upsertPermissions(MongoTemplate mongoTemplate) {
        Map<String, Permission> result = new LinkedHashMap<>();
        for (Map.Entry<String, List<String>> entry : RESOURCE_ACTIONS.entrySet()) {
            for (String action : entry.getValue()) {
                String name = entry.getKey() + "." + action;
                Permission permission = Permission.builder()
                        .name(name)
                        .description(buildDescription(entry.getKey(), action))
                        .build();
                mongoTemplate.save(permission);
                result.put(name, permission);
            }
        }
        return result;
    }

    private void updateRolePermissions(MongoTemplate mongoTemplate, String roleName, Set<String> permissionNames) {
        Query query = Query.query(Criteria.where("_id").is(roleName));
        Role role = mongoTemplate.findOne(query, Role.class);
        if (role == null) {
            return;
        }

        Set<Permission> permissions = permissionNames.stream()
                .map(name -> mongoTemplate.findById(name, Permission.class))
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());

        role.setPermissions(permissions);
        mongoTemplate.save(role);
    }

    private String buildDescription(String resource, String action) {
        return action + " " + resource.replace('_', ' ');
    }
}
