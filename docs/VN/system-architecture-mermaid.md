# SmartCV System Diagrams

Tài liệu này gom các sơ đồ Mermaid cho kiến trúc tổng thể, luồng dữ liệu và các chức năng chính của SmartCV.

## 1. Kiến trúc hệ thống tổng thể

```mermaid
flowchart LR
    classDef client fill:#E8F1FF,stroke:#3B82F6,color:#0F172A,stroke-width:1px
    classDef service fill:#F8FAFC,stroke:#334155,color:#0F172A,stroke-width:1px
    classDef infra fill:#ECFDF5,stroke:#10B981,color:#064E3B,stroke-width:1px
    classDef data fill:#FFF7ED,stroke:#F97316,color:#7C2D12,stroke-width:1px
    classDef async fill:#FEF3C7,stroke:#D97706,color:#78350F,stroke-width:1px

    subgraph Clients[Client Applications]
        WC[Web Candidate<br/>port:3000]
        WR[Web Recruiter<br/>port:3001]
        WA[Web Admin<br/>port:3003]
    end

    AGW[API Gateway<br/>JWT + Routing + Rate Limiting<br/>port:8080]

    subgraph Services[Backend Microservices]
        US[User Service<br/>Auth, User, Candidate, Recruiter<br/>port:8081]
        JS[Job Service<br/>Jobs, Search, Moderation Data<br/>port:8082]
        AS[Application Service<br/>Applications, Assessments<br/>port:8083]
        NS[Notification Service<br/>OTP, In-app Notification, FCM<br/>port:8084]
        AIS[AI Engine Service<br/>CV Analysis, Recommend, Interview Q&A<br/>port:8085]
        PS[Payment Service<br/>Orders, PayOS, Package Activation<br/>port:8086]
    end

    subgraph DataStores[Datastores and Infra]
        MDB[(MongoDB)]
        ES[(Elasticsearch)]
        PG[(PostgreSQL)]
        REDIS[(Redis)]
        S3[(MinIO / S3 Bucket)]
        RMQ[(RabbitMQ)]
        PAYOS[(PayOS Gateway)]
    end

    WC --> AGW
    WR --> AGW
    WA --> AGW

    AGW --> US
    AGW --> JS
    AGW --> AS
    AGW --> NS
    AGW --> AIS
    AGW --> PS

    US --> MDB
    JS --> MDB
    JS --> ES
    AS --> MDB
    AS --> S3
    PS --> MDB
    NS --> PG
    NS --> REDIS

    US <--> RMQ
    AS <--> RMQ
    AIS <--> RMQ
    NS <--> RMQ
    PS <--> RMQ

    PS --> PAYOS
    PAYOS --> PS

    class WC,WR,WA client
    class AGW,US,JS,AS,NS,AIS,PS service
    class MDB,ES,PG,REDIS,S3,PAYOS data
    class RMQ infra
```

## 2. Sơ đồ luồng dữ liệu tổng quát

```mermaid
flowchart TB
    classDef actor fill:#E0F2FE,stroke:#0284C7,color:#0C4A6E
    classDef process fill:#F8FAFC,stroke:#475569,color:#0F172A
    classDef store fill:#FEF3C7,stroke:#CA8A04,color:#713F12
    classDef event fill:#DCFCE7,stroke:#16A34A,color:#14532D

    U[Người dùng<br/>Candidate / Recruiter / Admin]
    FE[Frontend Apps<br/>React + TanStack]
    GW[API Gateway]
    SVC[Microservices]
    DB[(MongoDB / PostgreSQL / Elasticsearch)]
    OBJ[(MinIO / S3)]
    MQ[[RabbitMQ Events]]
    AI[AI Engine]
    NOTI[Notification Service]
    PAY[Payment Service]
    PAYOS[PayOS]

    U -->|Tương tác UI| FE
    FE -->|REST + JWT| GW
    GW -->|Route theo domain| SVC

    SVC -->|Đọc/ghi nghiệp vụ| DB
    SVC -->|Upload / lấy file CV| OBJ
    SVC -->|Phát sự kiện bất đồng bộ| MQ
    SVC -->|Tạo đơn, webhook, đồng bộ gói| PAY

    MQ --> AI
    MQ --> NOTI

    AI -->|Kết quả phân tích / gợi ý| DB
    NOTI -->|Thông báo OTP / in-app / push| FE
    PAY -->|Thanh toán / tạo order| PAYOS
    PAYOS -->|Webhook / trạng thái đơn| PAY
    FE -->|Hiển thị kết quả| U

    class U actor
    class FE,GW,SVC,AI,NOTI,PAY process
    class DB,OBJ store
    class MQ event
    class PAYOS store
```

## 3. Chức năng chính

### 3.1 Đăng ký, xác thực OTP, đăng nhập

```mermaid
flowchart TB
    classDef actor fill:#E0F2FE,stroke:#0284C7,color:#0C4A6E
    classDef svc fill:#F8FAFC,stroke:#475569,color:#0F172A
    classDef store fill:#FEF3C7,stroke:#CA8A04,color:#713F12

    C[Người dùng]
    FE[Web Candidate / Recruiter]
    GW[API Gateway]
    AUTH[User Service<br/>AuthController]
    OTP[Notification Service<br/>OTP API]
    UDB[(MongoDB Users)]
    CACHE[(Redis OTP Cache)]

    C --> FE
    FE -->|register / login| GW
    GW --> AUTH
    AUTH -->|tạo user pending| UDB
    AUTH -->|gửi OTP| OTP
    OTP --> CACHE
    OTP -->|email / sms OTP| C
    C -->|nhập OTP| FE
    FE -->|verify-registration| GW
    GW --> AUTH
    AUTH -->|kiểm tra OTP + kích hoạt tài khoản| UDB
    FE -->|login| GW
    GW --> AUTH
    AUTH -->|access token + refresh token| FE

    class C actor
    class FE,GW,AUTH,OTP svc
    class UDB,CACHE store
```

### 3.2 Upload CV, phân tích AI, gợi ý việc làm

```mermaid
flowchart TB
    classDef actor fill:#E0F2FE,stroke:#0284C7,color:#0C4A6E
    classDef svc fill:#F8FAFC,stroke:#475569,color:#0F172A
    classDef store fill:#FEF3C7,stroke:#CA8A04,color:#713F12
    classDef event fill:#DCFCE7,stroke:#16A34A,color:#14532D

    C[Candidate]
    FE[Web Candidate]
    GW[API Gateway]
    US[User Service<br/>CandidateController]
    S3[(MinIO / S3)]
    RMQ[[Skill Extract Event]]
    AI[AI Engine Service]
    UDB[(MongoDB Candidate Profile)]
    JOB[Job Service]
    ES[(Elasticsearch)]

    C --> FE
    FE -->|upload CV| GW
    GW --> US
    US -->|lưu file CV| S3
    US -->|lưu metadata CV| UDB
    US -->|publish skill extract| RMQ
    RMQ --> AI
    AI -->|phân tích kỹ năng / CV| UDB

    FE -->|job-suggestions| GW
    GW --> US
    US -->|lấy hồ sơ + skill đã phân tích| UDB
    US -->|truy vấn job phù hợp| JOB
    JOB --> ES
    JOB --> US
    US --> FE

    class C actor
    class FE,GW,US,AI,JOB svc
    class S3,UDB,ES store
    class RMQ event
```

### 3.3 Nhà tuyển dụng đăng tin và admin duyệt tin

```mermaid
flowchart TB
    classDef actor fill:#E0F2FE,stroke:#0284C7,color:#0C4A6E
    classDef svc fill:#F8FAFC,stroke:#475569,color:#0F172A
    classDef store fill:#FEF3C7,stroke:#CA8A04,color:#713F12

    R[Recruiter]
    A[Admin]
    WR[Web Recruiter]
    WA[Web Admin]
    GW[API Gateway]
    US[User Service<br/>RecruiterController]
    JS[Job Service<br/>JobController]
    UDB[(MongoDB Recruiters)]
    JDB[(MongoDB Jobs)]
    ES[(Elasticsearch)]

    R --> WR
    WR -->|submit profile / business license| GW
    GW --> US
    US -->|cập nhật trạng thái recruiter| UDB

    WR -->|create job| GW
    GW --> JS
    JS -->|lưu draft / pending job| JDB

    A --> WA
    WA -->|review recruiter / review job| GW
    GW --> US
    GW --> JS
    US -->|approve recruiter| UDB
    JS -->|approve / reject job| JDB
    JS -->|index active job| ES

    class R,A actor
    class WR,WA,GW,US,JS svc
    class UDB,JDB,ES store
```

### 3.4 Candidate ứng tuyển, recruiter sàng lọc, hệ thống gửi thông báo

```mermaid
flowchart TB
    classDef actor fill:#E0F2FE,stroke:#0284C7,color:#0C4A6E
    classDef svc fill:#F8FAFC,stroke:#475569,color:#0F172A
    classDef store fill:#FEF3C7,stroke:#CA8A04,color:#713F12
    classDef event fill:#DCFCE7,stroke:#16A34A,color:#14532D

    C[Candidate]
    R[Recruiter]
    WC[Web Candidate]
    WR[Web Recruiter]
    GW[API Gateway]
    APP[Application Service]
    JOB[Job Service]
    USER[User Service]
    AI[AI Engine Service]
    NOTI[Notification Service]
    ADB[(MongoDB Applications)]
    S3[(MinIO / S3)]
    RMQ[[Domain Events]]

    C --> WC
    WC -->|apply job| GW
    GW --> APP
    APP -->|đọc job info| JOB
    APP -->|đọc candidate CV / profile| USER
    APP -->|lưu application| ADB
    APP -->|tham chiếu CV file| S3
    APP -->|publish application submitted| RMQ
    RMQ --> NOTI
    RMQ --> AI

    AI -->|AI score / screening insight| APP

    R --> WR
    WR -->|xem danh sách ứng viên| GW
    GW --> APP
    APP --> WR

    WR -->|update status| GW
    GW --> APP
    APP -->|publish status changed| RMQ
    RMQ --> NOTI
    NOTI -->|in-app / push / email| C

    class C,R actor
    class WC,WR,GW,APP,JOB,USER,AI,NOTI svc
    class ADB,S3 store
    class RMQ event
```

### 3.5 Mua gói dịch vụ, thanh toán PayOS, kích hoạt package

```mermaid
flowchart TB
    classDef actor fill:#E0F2FE,stroke:#0284C7,color:#0C4A6E
    classDef svc fill:#F8FAFC,stroke:#475569,color:#0F172A
    classDef store fill:#FEF3C7,stroke:#CA8A04,color:#713F12
    classDef event fill:#DCFCE7,stroke:#16A34A,color:#14532D

    U[Candidate / Recruiter]
    FE[Web Candidate / Web Recruiter]
    GW[API Gateway]
    PAY[Payment Service]
    US[User Service]
    RMQ[[payment.completed Event]]
    PAYOS[PayOS]
    MDB[(MongoDB Payment Orders)]
    UDB[(MongoDB Users / Recruiters / Candidates)]

    U --> FE
    FE -->|chọn gói / tạo đơn| GW
    GW --> PAY
    PAY -->|lưu order PENDING| MDB
    PAY -->|tạo payment link| PAYOS
    PAYOS -->|webhook thanh toán| PAY
    PAY -->|publish payment.completed| RMQ
    RMQ --> US
    US -->|kích hoạt package| UDB
    FE -->|xem lịch sử giao dịch| GW
    GW --> PAY

    class U actor
    class FE,GW,PAY,US svc
    class MDB,UDB store
    class RMQ event
    class PAYOS store
```

## 4. Gợi ý sử dụng

- Dùng sơ đồ `1` khi mô tả kiến trúc tổng thể.
- Dùng sơ đồ `2` khi thuyết minh đường đi dữ liệu và tích hợp async.
- Dùng nhóm sơ đồ `3.x` khi trình bày use case chính với stakeholder cụ thể.
- Nếu cần render ít bị chồng chéo hơn nữa trong wiki, giữ từng sơ đồ ở một block Mermaid riêng như hiện tại, không gộp lại.

## 5. Biểu đồ trạng thái

### 5.1 Trạng thái application

```mermaid
stateDiagram-v2
    [*] --> PENDING: submit application
    PENDING --> REVIEWING: recruiter opens / screens
    REVIEWING --> ACCEPTED: accept
    REVIEWING --> REJECTED: reject
    PENDING --> WITHDRAWN: candidate withdraw
    REVIEWING --> WITHDRAWN: candidate withdraw

    ACCEPTED --> [*]
    REJECTED --> [*]
    WITHDRAWN --> [*]
```

### 5.2 Trạng thái job

```mermaid
stateDiagram-v2
    [*] --> DRAFT: recruiter creates job
    DRAFT --> PENDING: submit for approval
    PENDING --> PUBLISHED: admin approves
    PENDING --> DRAFT: admin rejects / recruiter edits
    PUBLISHED --> INACTIVE: recruiter deactivates
    INACTIVE --> ACTIVE: recruiter activates
    ACTIVE --> EXPIRED: end date reached
    EXPIRED --> INACTIVE: archive or pause

    DRAFT --> [*]
    PENDING --> [*]
    PUBLISHED --> [*]
    INACTIVE --> [*]
    ACTIVE --> [*]
    EXPIRED --> [*]
```

### 5.3 Trạng thái recruiter profile

```mermaid
stateDiagram-v2
    [*] --> DRAFT: create profile
    DRAFT --> PENDING: submit for approval
    PENDING --> APPROVED: admin approves
    PENDING --> REJECTED: admin rejects
    REJECTED --> PENDING: resubmit
    APPROVED --> PENDING: submit updated profile

    DRAFT --> [*]
    PENDING --> [*]
    APPROVED --> [*]
    REJECTED --> [*]
```
