## Latest Progress

- Completed backend CRUD for service packages in `user-service` with seeded default plans and admin-only endpoints.
- Connected `web-admin` packages page to live APIs for create, read, update, and delete flows while preserving the existing card-based design.
- Verified changes with `bash mvnw test -Dtest=ServicePackageServiceTest,ServicePackageControllerTest` and `pnpm -F web-admin build`.
