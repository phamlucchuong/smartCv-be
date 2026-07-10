package vn.chuongpl.job_service.features.job;

import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;

public interface JobElasticsearchRepository extends ElasticsearchRepository<JobDocument, String> {
}
