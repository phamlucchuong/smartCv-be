import { describe, expect, it } from 'vitest'
import {
  buildCreateJobPayload,
  getTomorrowDateInputValue,
  validateDraftJob,
  validateCreateJobStep,
} from './jobForm'

describe('jobForm', () => {
  it('builds the create job payload using trimmed values and line-split arrays', () => {
    expect(
      buildCreateJobPayload({
        title: '  Backend Developer  ',
        description: ' Build APIs ',
        companyName: ' FPT Software ',
        location: ' Ho Chi Minh City ',
        jobType: 'FULL_TIME',
        category: 'IT_SOFTWARE',
        experienceLevel: 'SENIOR',
        salaryMin: '25000000',
        salaryMax: '40000000',
        isNegotiable: false,
        skills: ['Java', 'Spring Boot'],
        requirementsText: 'REST API\nDocker\n',
        benefitsText: 'Laptop\nBonus\n',
        deadline: '2026-06-20',
        openings: '5',
        qualifiedThreshold: 70,
        rejectThreshold: 50,
        autoRejectEnabled: false,
        requiredTest: 'Không',
      }),
    ).toEqual({
      title: 'Backend Developer',
      description: 'Build APIs',
      company: 'FPT Software',
      location: 'Ho Chi Minh City',
      jobType: 'FULL_TIME',
      experienceLevel: 'SENIOR',
      salaryMin: 25000000,
      salaryMax: 40000000,
      skills: ['Java', 'Spring Boot'],
      requirements: ['REST API', 'Docker'],
      benefits: ['Laptop', 'Bonus'],
      deadline: '2026-06-20',
      openings: 5,
      qualifiedThreshold: 70,
      rejectThreshold: 50,
      autoRejectEnabled: false,
      requiredTest: undefined,
    })
  })

  it('omits salary fields when the salary is negotiable', () => {
    expect(
      buildCreateJobPayload({
        title: 'Backend Developer',
        description: 'Build APIs',
        companyName: 'FPT Software',
        location: 'Ho Chi Minh City',
        jobType: 'FULL_TIME',
        category: 'IT_SOFTWARE',
        experienceLevel: 'SENIOR',
        salaryMin: '25000000',
        salaryMax: '40000000',
        isNegotiable: true,
        skills: [],
        requirementsText: '',
        benefitsText: '',
        deadline: '',
        openings: '',
        qualifiedThreshold: 80,
        rejectThreshold: 40,
        autoRejectEnabled: true,
        requiredTest: 'Backend Technical Test',
      }),
    ).toEqual({
      title: 'Backend Developer',
      description: 'Build APIs',
      company: 'FPT Software',
      location: 'Ho Chi Minh City',
      jobType: 'FULL_TIME',
      experienceLevel: 'SENIOR',
      salaryMin: undefined,
      salaryMax: undefined,
      skills: [],
      requirements: [],
      benefits: [],
      deadline: undefined,
      openings: undefined,
      qualifiedThreshold: 80,
      rejectThreshold: 40,
      autoRejectEnabled: true,
      requiredTest: 'Backend Technical Test',
    })
  })

  it('omits enum fields when saving an incomplete draft', () => {
    expect(
      buildCreateJobPayload({
        title: 'Backend Developer',
        description: '',
        companyName: 'FPT Software',
        location: '',
        jobType: '',
        category: '',
        experienceLevel: '',
        salaryMin: '',
        salaryMax: '',
        isNegotiable: false,
        skills: [],
        requirementsText: '',
        benefitsText: '',
        deadline: '',
        openings: '',
        qualifiedThreshold: 80,
        rejectThreshold: 40,
        autoRejectEnabled: true,
        requiredTest: 'Không',
      }),
    ).toEqual({
      title: 'Backend Developer',
      description: '',
      company: 'FPT Software',
      location: '',
      salaryMin: undefined,
      salaryMax: undefined,
      skills: [],
      requirements: [],
      benefits: [],
      deadline: undefined,
      openings: undefined,
      qualifiedThreshold: 80,
      rejectThreshold: 40,
      autoRejectEnabled: true,
      requiredTest: undefined,
    })
  })

  it('validates required fields per wizard step', () => {
    expect(
      validateCreateJobStep(0, {
        title: '',
        location: '',
        jobType: '',
        description: '',
        experienceLevel: '',
      }),
    ).toEqual({
      title: 'Vui lòng nhập vị trí tuyển dụng',
      location: 'Vui lòng nhập địa điểm làm việc',
      jobType: 'Vui lòng chọn loại hình công việc',
    })

    expect(
      validateCreateJobStep(1, {
        title: 'Backend Developer',
        location: 'Ho Chi Minh City',
        jobType: 'FULL_TIME',
        description: '',
        experienceLevel: '',
      }),
    ).toEqual({
      description: 'Vui lòng nhập mô tả công việc',
      experienceLevel: 'Vui lòng chọn mức kinh nghiệm',
    })
  })

  it('validates drafts with only title required', () => {
    expect(
      validateDraftJob({
        title: '',
        location: '',
        jobType: '',
        description: '',
        experienceLevel: '',
      }),
    ).toEqual({
      title: 'Vui lòng nhập vị trí tuyển dụng',
    })

    expect(
      validateDraftJob({
        title: 'Backend Developer',
        location: '',
        jobType: '',
        description: '',
        experienceLevel: '',
      }),
    ).toEqual({})
  })

  it('returns tomorrow in input date format', () => {
    expect(getTomorrowDateInputValue(new Date(2026, 5, 16, 0, 30))).toBe('2026-06-17')
  })
})
