package vn.chuongpl.ai_engine_service.integration.onet;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.Collections;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class OnetTechnologySkillsResponse {

    private List<Category> category;
    private List<Example> example;

    public OnetTechnologySkillsResponse() {
    }

    public OnetTechnologySkillsResponse(List<Category> category, List<String> exampleTitles) {
        this.category = category;
        this.example = exampleTitles == null ? Collections.emptyList() : exampleTitles.stream()
                .map(Example::new)
                .toList();
    }

    public List<Category> getCategory() {
        return category == null ? Collections.emptyList() : category;
    }

    public void setCategory(List<Category> category) {
        this.category = category;
    }

    public List<Example> getExample() {
        return example == null ? Collections.emptyList() : example;
    }

    public void setExample(List<Example> example) {
        this.example = example;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Category {
        private String title;
        private String name;
        private List<Example> example;

        public Category() {
        }

        public Category(String title, List<String> exampleTitles) {
            this.title = title;
            this.name = title;
            this.example = exampleTitles == null ? Collections.emptyList() : exampleTitles.stream()
                    .map(Example::new)
                    .toList();
        }

        public String title() {
            return title;
        }

        public String name() {
            return name;
        }

        public List<Example> example() {
            return example == null ? Collections.emptyList() : example;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public void setName(String name) {
            this.name = name;
        }

        public void setExample(List<Example> example) {
            this.example = example;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Example {
        private String title;
        private String name;

        public Example() {
        }

        public Example(String title) {
            this.title = title;
            this.name = title;
        }

        public String title() {
            return title;
        }

        public String name() {
            return name;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public void setName(String name) {
            this.name = name;
        }
    }
}
