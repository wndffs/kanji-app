import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Put,
  UseGuards,
} from "@nestjs/common";

import { AdminGuard } from "../auth/admin.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { type CurrentUserDto } from "../auth/auth.types";
import { AdminService } from "./admin.service";

@UseGuards(AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  @Get("status")
  getStatus(@CurrentUser() user: CurrentUserDto): {
    readonly ok: true;
    readonly userId: string;
    readonly role: "ADMIN";
  } {
    return {
      ok: true,
      userId: user.id,
      role: "ADMIN",
    };
  }

  @Get("items/review-queue")
  listReviewItems(@Query() query: Record<string, unknown>) {
    return this.adminService.listReviewItems(query);
  }

  @Get("import-runs")
  listImportRuns() {
    return this.adminService.listImportRuns();
  }

  @Get("imported-candidates")
  listImportedCandidates() {
    return this.adminService.listImportedCandidates();
  }

  @Get("imported-candidates/rejections")
  listImportedCandidateRejections() {
    return this.adminService.listImportedCandidateRejections();
  }

  @Put("imported-candidates/:targetType/:targetId/rejection")
  rejectImportedCandidate(
    @CurrentUser() user: CurrentUserDto,
    @Param("targetType") targetType: string,
    @Param("targetId") targetId: string,
    @Body() body: unknown,
  ) {
    return this.adminService.rejectImportedCandidate(user.id, targetType, targetId, body);
  }

  @Delete("imported-candidates/:targetType/:targetId/rejection")
  restoreImportedCandidate(
    @Param("targetType") targetType: string,
    @Param("targetId") targetId: string,
  ) {
    return this.adminService.restoreImportedCandidate(targetType, targetId);
  }

  @Get("imported-candidates/:targetType/:targetId")
  getImportedCandidateDetails(
    @Param("targetType") targetType: string,
    @Param("targetId") targetId: string,
  ) {
    return this.adminService.getImportedCandidateDetails(targetType, targetId);
  }

  @Get("curriculum/completeness")
  getCompletenessReport() {
    return this.adminService.getCompletenessReport();
  }

  @Get("curriculum/scale-readiness")
  getScaleReadiness() {
    return this.adminService.getScaleReadiness();
  }

  @Get("curriculum/main-course/allocation-preview")
  getCourseAllocationPreview() {
    return this.adminService.getCourseAllocationPreview();
  }

  @Post("curriculum/main-course/allocation")
  applyCourseAllocation(@Body() body: unknown) {
    return this.adminService.applyCourseAllocation(body);
  }

  @Get("curriculum/main-course/publication-readiness")
  getMainCoursePublicationReadiness() {
    return this.adminService.getMainCoursePublicationReadiness();
  }

  @Post("curriculum/main-course/publication")
  publishMainCourse(@Body() body: unknown) {
    return this.adminService.publishMainCourse(body);
  }

  @Get("curriculum/main-course/enrollment-rollout-preview")
  getMainCourseEnrollmentRolloutPreview() {
    return this.adminService.getMainCourseEnrollmentRolloutPreview();
  }

  @Get("curriculum/candidate-plan")
  getCandidatePlan(@Query() query: Record<string, unknown>) {
    return this.adminService.getCandidatePlan(query);
  }

  @Post("curriculum/candidate-plan/enqueue")
  enqueueCandidatePlan(@Body() body: unknown) {
    return this.adminService.enqueueCandidatePlan(body);
  }

  @Get("items/:itemId")
  getCurationItem(@Param("itemId") itemId: string) {
    return this.adminService.getCurationItem(itemId);
  }

  @Get("items/:itemId/prerequisite-candidates")
  getPrerequisiteCandidates(@Param("itemId") itemId: string) {
    return this.adminService.getPrerequisiteCandidates(itemId);
  }

  @Get("items/:itemId/course-placements")
  getCoursePlacements(@Param("itemId") itemId: string) {
    return this.adminService.getCoursePlacements(itemId);
  }

  @Put("items/:itemId/prerequisites")
  updatePrerequisites(@Param("itemId") itemId: string, @Body() body: unknown) {
    return this.adminService.updatePrerequisites(itemId, body);
  }

  @Put("items/:itemId/course-placements")
  updateCoursePlacements(@Param("itemId") itemId: string, @Body() body: unknown) {
    return this.adminService.updateCoursePlacements(itemId, body);
  }

  @Patch("items/:itemId")
  updateItem(@Param("itemId") itemId: string, @Body() body: unknown) {
    return this.adminService.updateItem(itemId, body);
  }

  @Patch("cards/:cardId/answers")
  updateCardAnswers(@Param("cardId") cardId: string, @Body() body: unknown) {
    return this.adminService.updateCardAnswers(cardId, body);
  }

  @Post("imported-candidates/promote")
  promoteImportedCandidate(@Body() body: unknown) {
    return this.adminService.promoteImportedCandidate(body);
  }

  @Post("imported-candidates/approve-translation")
  approveImportedTranslation(@Body() body: unknown) {
    return this.adminService.approveImportedTranslation(body);
  }
}
