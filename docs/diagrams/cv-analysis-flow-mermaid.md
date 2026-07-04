# CV Analysis Flow

Sơ đồ này mô tả luồng chức năng `POST /api/ai/analyze-cv` trong `ai_engine_service`, tách rõ 2 trường hợp:
- Có `jobId`: so CV với JD cụ thể
- Không có `jobId`: suy luận nghề mục tiêu từ CV, sau đó đối chiếu với O*NET hoặc fallback LLM

Các khối "skill" bên dưới bám theo code hiện tại trong:
- `AnalysisService`
- `StructuredProfileExtractionService`
- `DeterministicCvScoringService`
- `OnetOccupationKnowledgeService`

## 1. Luồng tổng quát

```mermaid
flowchart TD
    classDef input fill:#E0F2FE,stroke:#0284C7,color:#0C4A6E
    classDef process fill:#F8FAFC,stroke:#475569,color:#0F172A
    classDef ai fill:#FEF3C7,stroke:#D97706,color:#78350F
    classDef deterministic fill:#DCFCE7,stroke:#16A34A,color:#14532D
    classDef external fill:#FCE7F3,stroke:#DB2777,color:#831843
    classDef output fill:#EDE9FE,stroke:#7C3AED,color:#4C1D95

    A[Candidate gọi /api/ai/analyze-cv<br/>cvId + optional jobId] --> B[UserClient.getCvInfo<br/>kiểm tra owner + consume AI credit]
    B --> C[CvTextExtractor.resolveCvText<br/>lấy CV text từ cvUrl]
    C --> D[StructuredProfileExtractionService.extractCvProfile]
    D --> D1[Skill 1: Extract CV structured profile<br/>target roles, seniority, domains,<br/>technical/framework/database/cloud/tools]
    D1 --> E{Có jobId?}

    E -->|Có| F[JobClient.getJobById]
    F --> G[StructuredProfileExtractionService.extractJobRequirements]
    G --> G1[Skill 2: Extract JD requirements<br/>must-have, nice-to-have, tools,<br/>frameworks, databases, cloud, certs, min years]
    G1 --> H[DeterministicCvScoringService.score]
    H --> H1[So khớp CV skills với JD skills<br/>tính matched, missing, extra,<br/>experience, seniority, domain, bonus]
    H1 --> I[Skill 3: improveWithText<br/>LLM gợi ý strengths, weaknesses, tips theo JD]

    E -->|Không| J{CV có target role?}
    J -->|Không rõ| K[Skill 2a: extractJobTarget<br/>LLM suy luận vị trí mục tiêu từ CV]
    J -->|Có sẵn| L[Giữ target role từ CV structured profile]
    K --> M[OnetOccupationKnowledgeService.resolve]
    L --> M
    M --> N{Resolve được O*NET?}

    N -->|Có| O[Skill 2b: Extract O*NET requirements<br/>map target role sang requirement profile]
    O --> P[DeterministicCvScoringService.score]
    P --> Q[Skill 3: improveWithText<br/>LLM cải thiện CV theo O*NET job profile]

    N -->|Không| R[Skill 2c: analyzeWithText<br/>LLM chấm CV trực tiếp theo target role]
    R --> S[Skill 3: improveWithText<br/>LLM cải thiện CV theo target role]

    I --> T[Ghép CvFullAnalysisResponse]
    Q --> T
    S --> T
    T --> U[UserClient.updateCvAnalysis status DONE]
    T --> V[Async recommend top 3 jobs]

    class A input
    class B,C,F,U,V process
    class D,D1,G,G1,I,K,O,Q,R,S ai
    class H,H1,P deterministic
    class M,N external
    class T output
```

## 2. CV và JD đi qua những "skill" nào

```mermaid
flowchart LR
    classDef cv fill:#E0F2FE,stroke:#0284C7,color:#0C4A6E
    classDef jd fill:#FEF3C7,stroke:#D97706,color:#78350F
    classDef skill fill:#F8FAFC,stroke:#475569,color:#0F172A
    classDef score fill:#DCFCE7,stroke:#16A34A,color:#14532D

    CV[CV Text] --> SCV[Skill A<br/>Extract CV Structured Profile]
    SCV --> SCVOUT[targetRoles<br/>seniorityLevel<br/>domains<br/>technical<br/>frameworks<br/>databases<br/>cloud<br/>tools<br/>softSkills<br/>languages]

    JD[Job Description + skills + requirements] --> SJD[Skill B<br/>Extract JD Requirements]
    SJD --> SJDOUT[mustHaveSkills<br/>niceToHaveSkills<br/>mustHaveTools<br/>mustHaveFrameworks<br/>mustHaveDatabases<br/>mustHaveCloud<br/>mustHaveLanguages<br/>mustHaveCertifications<br/>minYearsExperience]

    SCVOUT --> SCORE[Deterministic CV Scoring]
    SJDOUT --> SCORE
    SCORE --> RESULT[matchedSkills<br/>missingSkills<br/>extraSkills<br/>breakdown<br/>evidence]

    class CV,SCVOUT cv
    class JD,SJDOUT jd
    class SCV,SJD skill
    class SCORE,RESULT score
```

## 3. Trường hợp có JD

```mermaid
sequenceDiagram
    participant FE as Candidate FE
    participant AI as AnalysisService
    participant USER as UserClient
    participant CVX as CvTextExtractor
    participant SP as StructuredProfileExtractionService
    participant JOB as JobClient
    participant SCORE as DeterministicCvScoringService
    participant LLM as Active AI Model

    FE->>AI: analyze-cv(cvId, jobId)
    AI->>USER: getCvInfo(cvId) + validate owner
    AI->>CVX: resolveCvText(cvUrl)
    AI->>SP: extractCvProfile(cvText)
    SP->>LLM: Extract CV structured profile
    AI->>JOB: getJobById(jobId)
    AI->>SP: extractJobRequirements(job)
    SP->>LLM: Extract JD structured requirements
    AI->>SCORE: score(cvProfile, jobRequirements)
    AI->>LLM: improveWithText(cvText, JD)
    AI->>USER: updateCvAnalysis(DONE)
    AI-->>FE: CvFullAnalysisResponse
```

## 4. Trường hợp không có JD

```mermaid
sequenceDiagram
    participant FE as Candidate FE
    participant AI as AnalysisService
    participant USER as UserClient
    participant CVX as CvTextExtractor
    participant SP as StructuredProfileExtractionService
    participant ONET as OnetOccupationKnowledgeService
    participant SCORE as DeterministicCvScoringService
    participant LLM as Active AI Model
    participant ODB as O*NET API

    FE->>AI: analyze-cv(cvId)
    AI->>USER: getCvInfo(cvId) + validate owner
    AI->>CVX: resolveCvText(cvUrl)
    AI->>SP: extractCvProfile(cvText)
    SP->>LLM: Extract CV structured profile

    alt CV chưa có target role rõ ràng
        AI->>LLM: extractJobTarget(cvText)
    end

    AI->>ONET: resolve(cvProfile)
    ONET->>ODB: search occupation + load overview/tasks/skills/knowledge/tech/education

    alt O*NET resolve thành công
        ONET->>LLM: Extract O*NET requirements
        AI->>SCORE: score(cvProfile, onetRequirements)
        AI->>LLM: improveWithText(cvText, onetJobProfile)
    else O*NET không resolve được
        AI->>LLM: analyzeWithText(cvText, targetRole)
        AI->>LLM: improveWithText(cvText, targetRole)
    end

    AI->>USER: updateCvAnalysis(DONE)
    AI-->>FE: CvFullAnalysisResponse
```

## 5. Tóm tắt theo nhánh

- Có JD:
  CV đi qua `extractCvProfile`, JD đi qua `extractJobRequirements`, sau đó vào `DeterministicCvScoringService.score`, cuối cùng gọi `improveWithText`.
- Không có JD nhưng resolve được O*NET:
  CV đi qua `extractCvProfile`, có thể thêm `extractJobTarget`, rồi qua `OnetOccupationKnowledgeService.resolve`, tiếp tục `score`, cuối cùng `improveWithText`.
- Không có JD và không resolve được O*NET:
  CV đi qua `extractCvProfile`, có thể thêm `extractJobTarget`, sau đó LLM chấm trực tiếp bằng `analyzeWithText`, rồi `improveWithText`.
