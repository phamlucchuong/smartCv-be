# Table Schema Notes

This folder now contains Markdown schema summaries, not DBML.

Each service file lists every table/collection as a separate section, and each section uses a 3-column table:

- `Tên cột`
- `Kiểu dữ liệu`
- `Mô tả`

Files:

- `user-service.tables.md`
- `job-service.tables.md`
- `application-service.tables.md`
- `notification-service.tables.md`
- `payment-service.tables.md`
- `smartcv.tables.md`

Scope:

- MongoDB services are documented by collection name and embedded JSON fields.
- PostgreSQL service is documented by table name.
- The combined file is a monolith-style summary of all core tables.
