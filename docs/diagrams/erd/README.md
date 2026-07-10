# ERD Diagrams

These DBML files are logical ERD views derived from the current codebase.

- `user-service.erd.dbml`
- `job-service.erd.dbml`
- `application-service.erd.dbml`
- `notification-service.erd.dbml`
- `payment-service.erd.dbml`
- `tables/` contains the table-focused DBML variants split by service.

Notes:
- MongoDB embedded documents are kept as JSON fields where the code stores them inline.
- Cross-service references are modeled with external stub tables so dbdiagram.io can render the relationships.
