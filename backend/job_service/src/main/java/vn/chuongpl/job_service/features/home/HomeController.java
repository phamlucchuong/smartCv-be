package vn.chuongpl.job_service.features.home;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.chuongpl.job_service.dtos.ApiResponse;
import vn.chuongpl.job_service.dtos.response.JobResponse;

import java.util.List;

@RestController
@RequestMapping("/api/home")
@RequiredArgsConstructor
public class HomeController {

    final HomeService homeService;

    @GetMapping("/stats")
    public ApiResponse<HomeStatsResponse> getStats() {
        return ApiResponse.<HomeStatsResponse>builder().data(homeService.getStats()).build();
    }

    @GetMapping("/categories")
    public ApiResponse<List<JobCategoryResponse>> getCategories() {
        return ApiResponse.<List<JobCategoryResponse>>builder().data(homeService.getCategories()).build();
    }

    @GetMapping("/featured-jobs")
    public ApiResponse<List<JobResponse>> getFeaturedJobs() {
        return ApiResponse.<List<JobResponse>>builder().data(homeService.getFeaturedJobs()).build();
    }

    @GetMapping("/hot-jobs")
    public ApiResponse<List<JobResponse>> getHotJobs() {
        return ApiResponse.<List<JobResponse>>builder().data(homeService.getHotJobs()).build();
    }

    @GetMapping("/top-companies")
    public ApiResponse<List<TopCompanyResponse>> getTopCompanies() {
        return ApiResponse.<List<TopCompanyResponse>>builder().data(homeService.getTopCompanies()).build();
    }

    @GetMapping("/resources")
    public ApiResponse<List<ResourceItem>> getResources() {
        return ApiResponse.<List<ResourceItem>>builder().data(homeService.getResources()).build();
    }

    @GetMapping("/testimonials")
    public ApiResponse<List<TestimonialItem>> getTestimonials() {
        return ApiResponse.<List<TestimonialItem>>builder().data(homeService.getTestimonials()).build();
    }

    @GetMapping("/faqs")
    public ApiResponse<List<FaqItem>> getFaqs() {
        return ApiResponse.<List<FaqItem>>builder().data(homeService.getFaqs()).build();
    }
}
