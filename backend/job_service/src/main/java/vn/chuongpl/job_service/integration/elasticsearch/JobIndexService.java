package vn.chuongpl.job_service.integration.elasticsearch;

import co.elastic.clients.elasticsearch._types.SortOrder;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import co.elastic.clients.elasticsearch._types.query_dsl.TermQuery;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchTemplate;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.client.elc.NativeQueryBuilder;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.stereotype.Service;
import vn.chuongpl.job_service.dtos.PageResponse;
import vn.chuongpl.job_service.dtos.request.JobSearchRequest;
import vn.chuongpl.job_service.dtos.response.JobResponse;
import vn.chuongpl.job_service.enums.JobModerationStatus;
import vn.chuongpl.job_service.enums.JobVisibilityStatus;
import vn.chuongpl.job_service.features.job.*;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@ConditionalOnProperty(name = "app.search.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class JobIndexService {
    JobElasticsearchRepository esRepository;
    ElasticsearchTemplate elasticsearchTemplate;
    JobMapper jobMapper;

    public void indexJob(Job job) {
        try {
            esRepository.save(jobMapper.toDocument(job));
        } catch (Exception e) {
            log.warn("Index job failed for id {}: {}", job.getId(), e.getMessage());
        }
    }

    /**
     * Drops and recreates the index from the {@link JobDocument} annotations.
     * Needed because an existing index keeps its old (possibly dynamic) mapping,
     * which breaks the exact term filters used in {@link #search}.
     */
    public void recreateIndex() {
        var indexOps = elasticsearchTemplate.indexOps(JobDocument.class);
        if (indexOps.exists()) {
            indexOps.delete();
        }
        indexOps.createWithMapping();
    }

    public void removeFromIndex(String jobId) {
        try {
            esRepository.deleteById(jobId);
        } catch (Exception e) {
            log.warn("Remove job index failed for id {}: {}", jobId, e.getMessage());
        }
    }

    public PageResponse<JobResponse> search(JobSearchRequest request) {
        int page = request.getPage() > 0 ? request.getPage() - 1 : 0;
        int size = request.getSize() > 0 ? request.getSize() : 10;
        Pageable pageable = PageRequest.of(page, size);

        List<Query> filters = new ArrayList<>();
        filters.add(TermQuery.of(t -> t.field("moderationStatus").value(JobModerationStatus.PUBLISHED.name()))._toQuery());
        filters.add(TermQuery.of(t -> t.field("visibilityStatus").value(JobVisibilityStatus.ACTIVE.name()))._toQuery());

        if (request.getLocation() != null && !request.getLocation().isBlank()) {
            filters.add(TermQuery.of(t -> t.field("location").value(request.getLocation()))._toQuery());
        }
        if (request.getJobType() != null) {
            filters.add(TermQuery.of(t -> t.field("jobType").value(request.getJobType().name()))._toQuery());
        }
        if (request.getExperienceLevel() != null) {
            filters.add(TermQuery.of(t -> t.field("experienceLevel").value(request.getExperienceLevel().name()))._toQuery());
        }
        if (request.getSkills() != null) {
            request.getSkills().forEach(skill -> filters.add(TermQuery.of(t -> t.field("skills").value(skill))._toQuery()));
        }
        if (request.getCategory() != null) {
            filters.add(TermQuery.of(t -> t.field("category").value(request.getCategory().name()))._toQuery());
        }
        if (request.getSalaryMin() != null) {
            filters.add(Query.of(q -> q.range(r -> r.number(n -> n.field("salaryMin").gte(request.getSalaryMin())))));
        }
        if (request.getSalaryMax() != null) {
            filters.add(Query.of(q -> q.range(r -> r.number(n -> n.field("salaryMax").lte(request.getSalaryMax())))));
        }

        NativeQueryBuilder queryBuilder = NativeQuery.builder().withPageable(pageable)
                .withQuery(q -> q.bool(b -> {
                    if (request.getKeyword() != null && !request.getKeyword().isBlank()) {
                        b.must(m -> m.multiMatch(mm -> mm.fields("title^3", "description", "company^2").query(request.getKeyword())));
                    }
                    filters.forEach(b::filter);
                    return b;
                }));

        String sortBy = request.getSortBy() == null || request.getSortBy().isBlank() ? "createdAt" : request.getSortBy();
        SortOrder sortOrder = "asc".equalsIgnoreCase(request.getSortDir()) ? SortOrder.Asc : SortOrder.Desc;
        queryBuilder.withSort(s -> s.field(f -> f.field(sortBy).order(sortOrder)));

        NativeQuery query = queryBuilder.build();
        var hits = elasticsearchTemplate.search(query, JobDocument.class);
        List<JobResponse> items = hits.getSearchHits().stream().map(SearchHit::getContent).map(jobMapper::toJobResponse).toList();

        long total = hits.getTotalHits();
        Page<JobResponse> resultPage = new PageImpl<>(items, pageable, total);

        return PageResponse.<JobResponse>builder()
                .items(resultPage.getContent())
                .total(resultPage.getTotalElements())
                .page(page + 1)
                .pageSize(size)
                .totalPages(resultPage.getTotalPages())
                .build();
    }
}
