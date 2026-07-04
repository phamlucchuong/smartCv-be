package vn.chuongpl.ai_engine_service.integration.onet;

public record OnetOccupationBundle(
        OnetSearchResponse.Occupation occupation,
        OnetOverviewResponse overview,
        OnetJobZoneResponse jobZone,
        OnetTasksResponse tasks,
        OnetSkillsResponse skills,
        OnetKnowledgeResponse knowledge,
        OnetTechnologySkillsResponse technologySkills,
        OnetEducationResponse education
) {}
