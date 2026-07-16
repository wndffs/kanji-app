import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  type CourseBand,
  type CourseEnrollmentStatus,
  type CourseListResponse,
  type CourseType,
  type EnrolledCourseDto,
} from "@kanji-srs/shared";

import { chooseCurrentCourseId } from "./current-course";
import { CoursesRepository } from "./courses.repository";
import { type CourseSelectionRecord, type EnrolledCourseRecord } from "./courses.types";

const MAX_COURSE_ID_LENGTH = 80;

@Injectable()
export class CoursesService {
  constructor(@Inject(CoursesRepository) private readonly coursesRepository: CoursesRepository) {}

  async listCourses(userId: string): Promise<CourseListResponse> {
    return toResponse(await this.coursesRepository.getSelection(userId));
  }

  async selectCurrentCourse(userId: string, body: unknown): Promise<CourseListResponse> {
    const courseId = parseCourseId(body);
    const currentSelection = toResponse(await this.coursesRepository.getSelection(userId));

    if (currentSelection.currentCourseId === courseId) {
      return currentSelection;
    }

    const result = await this.coursesRepository.setCurrentCourse(userId, courseId);

    if (result === "active-lesson") {
      throw new ConflictException("Finish or abandon the active lesson before changing course.");
    }

    if (result === "not-found") {
      throw new NotFoundException("Active published course enrollment not found.");
    }

    return this.listCourses(userId);
  }
}

function toResponse(selection: CourseSelectionRecord): CourseListResponse {
  const activeCandidates = selection.courses
    .filter(({ enrollmentStatus }) => enrollmentStatus === "ACTIVE")
    .map((course) => ({ id: course.id, slug: course.slug, startedAt: course.startedAt }));
  const currentCourseId = chooseCurrentCourseId(activeCandidates, selection.savedCurrentCourseId);

  return {
    currentCourseId,
    courses: selection.courses.map((course) => toDto(course, currentCourseId)),
  };
}

function toDto(course: EnrolledCourseRecord, currentCourseId: string | null): EnrolledCourseDto {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    targetLevel: course.targetLevel,
    band: course.band.toLowerCase() as CourseBand,
    courseType: course.courseType.toLowerCase() as CourseType,
    enrollmentStatus: course.enrollmentStatus.toLowerCase() as CourseEnrollmentStatus,
    isCurrent: course.id === currentCourseId,
  };
}

function parseCourseId(value: unknown): string {
  if (!isRecord(value) || typeof value.courseId !== "string") {
    throw new BadRequestException("courseId must be a string.");
  }

  const courseId = value.courseId.trim();

  if (courseId.length === 0 || courseId.length > MAX_COURSE_ID_LENGTH) {
    throw new BadRequestException(`courseId must be between 1 and ${MAX_COURSE_ID_LENGTH} chars.`);
  }

  return courseId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
