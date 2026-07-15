import {
  type AdminCandidatePlanCoverageFilter,
  type AdminApproveImportedTranslationRequest,
  type AdminCurationItemDto,
  type AdminCurriculumCandidatePlanResponse,
  type AdminCurriculumCompletenessReportDto,
  type AdminCurriculumScaleReadinessDto,
  type AdminEnqueueCandidatePlanRequest,
  type AdminEnqueueCandidatePlanResponse,
  type AdminImportRunListResponse,
  type AdminImportedCandidateDetailsDto,
  type AdminImportedCandidateListResponse,
  type AdminImportedCandidateRejectionDto,
  type AdminImportedCandidateRejectionListResponse,
  type AdminPromoteCandidateRequest,
  type AdminPrerequisiteCandidateListResponse,
  type AdminRejectImportedCandidateRequest,
  type AdminRestoreImportedCandidateResponse,
  type AdminReviewQueueFilters,
  type AdminReviewQueueResponse,
  type AdminUpdateCardAnswersRequest,
  type AdminUpdateItemRequest,
  type AdminUpdatePrerequisitesRequest,
  type ActiveLessonSessionResponse,
  type AppLocale,
  type CardAnswerType,
  type CheckLessonAnswerRequestDto,
  type CheckLessonAnswerResponse,
  type ContentLocale,
  type CourseBand,
  type CompleteLessonItemRequestDto,
  type DashboardDto,
  type CompleteLessonItemResponse,
  type CreateTextDeckRequest,
  type CreateTextDeckResponse,
  type FinishLessonSessionResponse,
  type ItemDetails,
  type KanaAssessmentAnswerRequest,
  type KanaAssessmentAnswerResponse,
  type KanaAssessmentProgressDto,
  type KanaLessonPathDto,
  type KanaScript,
  type DeckDetailsDto,
  type DeckListResponse,
  type LessonQueueResponse,
  type PracticeAnswerRequest,
  type PracticeAnswerResponse,
  type PracticeQueueResponse,
  type PracticeSource,
  type ReviewAnswerRequest,
  type ReviewAnswerResponse,
  type ReviewQueueItem,
  type SearchResponseDto,
  type StartLessonSessionResponse,
  type StartLessonSessionRequestDto,
  type TranslationDisplayMode,
  type UpdateDeckStatusRequest,
  type UpdateLessonSessionProgressRequestDto,
  type UpdateLessonSessionProgressResponse,
  type UserMnemonicDto,
  type UserOverrideDto,
} from "@kanji-srs/shared";

export type UserRole = "USER" | "ADMIN";

export type UserSettingsDto = {
  readonly locale: AppLocale;
  readonly translationDisplayMode: TranslationDisplayMode;
  readonly timezone: string;
  readonly dailyLessonLimit: number;
  readonly reviewBudget: number;
  readonly strictMode: boolean;
};

export type CurrentUserDto = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly role: UserRole;
  readonly settings: UserSettingsDto;
};

export type AuthSessionDto = {
  readonly user: CurrentUserDto;
  readonly accessToken: string;
  readonly tokenType: "Bearer";
  readonly expiresAt: string;
};

export type ReviewQueueResponse = {
  readonly items: readonly ReviewQueueItem[];
};

export type ReviewSessionDto = {
  readonly id: string;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly mode: "review" | "lesson-quiz" | "extra-practice";
};

export type StartReviewSessionResponse = {
  readonly session: ReviewSessionDto;
};

export type FinishReviewSessionResponse = {
  readonly session: ReviewSessionDto & { readonly finishedAt: string };
};

export type AddPrivateAcceptedAnswerInput = {
  readonly answerKind: CardAnswerType;
  readonly text: string;
  readonly locale: ContentLocale;
  readonly note?: string | null;
};

export type SavePrivateMnemonicInput = {
  readonly body: string;
  readonly locale: ContentLocale;
  readonly mnemonicType: "meaning" | "reading" | "story";
};

export type SavePrivateMnemonicResponse = {
  readonly mnemonic: UserMnemonicDto;
};

export type DeleteResponse = {
  readonly deleted: boolean;
};

export type ApiRequestOptions = {
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly token?: string | null;
  readonly body?: unknown;
  readonly fetchImpl?: typeof fetch;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = new Headers();

  headers.set("Accept", "application/json");

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetchImpl(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }

  return (await response.json()) as T;
}

export function login(email: string, password: string): Promise<AuthSessionDto> {
  return apiRequest<AuthSessionDto>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function register(input: {
  readonly email: string;
  readonly password: string;
  readonly displayName: string | null;
}): Promise<AuthSessionDto> {
  return apiRequest<AuthSessionDto>("/auth/register", {
    method: "POST",
    body: input,
  });
}

export function getDashboard(token: string): Promise<DashboardDto> {
  return apiRequest<DashboardDto>("/dashboard", { token });
}

export function getKanaAssessment(
  token: string,
  script: KanaScript,
): Promise<KanaAssessmentProgressDto> {
  return apiRequest<KanaAssessmentProgressDto>(
    `/kana/assessment?script=${encodeURIComponent(script)}`,
    { token },
  );
}

export function submitKanaAssessmentAnswer(
  token: string,
  input: KanaAssessmentAnswerRequest,
): Promise<KanaAssessmentAnswerResponse> {
  return apiRequest<KanaAssessmentAnswerResponse>("/kana/assessment/answer", {
    method: "POST",
    token,
    body: input,
  });
}

export function getKanaLessons(token: string, script: KanaScript): Promise<KanaLessonPathDto> {
  return apiRequest<KanaLessonPathDto>(`/kana/lessons?script=${encodeURIComponent(script)}`, {
    token,
  });
}

export function submitKanaLessonAnswer(
  token: string,
  input: KanaAssessmentAnswerRequest,
): Promise<KanaAssessmentAnswerResponse> {
  return apiRequest<KanaAssessmentAnswerResponse>("/kana/lessons/answer", {
    method: "POST",
    token,
    body: input,
  });
}

export function getAdminReviewQueue(token: string): Promise<AdminReviewQueueResponse> {
  return apiRequest<AdminReviewQueueResponse>("/admin/items/review-queue", { token });
}

export function getAdminReviewQueueWithFilters(
  token: string,
  filters: AdminReviewQueueFilters,
  fetchImpl?: typeof fetch,
): Promise<AdminReviewQueueResponse> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return apiRequest<AdminReviewQueueResponse>(
    `/admin/items/review-queue${query === "" ? "" : `?${query}`}`,
    { token, fetchImpl },
  );
}

export function getAdminImportRuns(token: string): Promise<AdminImportRunListResponse> {
  return apiRequest<AdminImportRunListResponse>("/admin/import-runs", { token });
}

export function getAdminImportedCandidates(
  token: string,
): Promise<AdminImportedCandidateListResponse> {
  return apiRequest<AdminImportedCandidateListResponse>("/admin/imported-candidates", { token });
}

export function getAdminImportedCandidateDetails(
  token: string,
  targetType: AdminImportedCandidateDetailsDto["itemType"],
  targetId: string,
): Promise<AdminImportedCandidateDetailsDto> {
  return apiRequest<AdminImportedCandidateDetailsDto>(
    `/admin/imported-candidates/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}`,
    { token },
  );
}

export function getAdminImportedCandidateRejections(
  token: string,
  fetchImpl?: typeof fetch,
): Promise<AdminImportedCandidateRejectionListResponse> {
  return apiRequest<AdminImportedCandidateRejectionListResponse>(
    "/admin/imported-candidates/rejections",
    { token, fetchImpl },
  );
}

export function rejectAdminImportedCandidate(
  token: string,
  targetType: "kanji" | "word",
  targetId: string,
  input: AdminRejectImportedCandidateRequest,
  fetchImpl?: typeof fetch,
): Promise<AdminImportedCandidateRejectionDto> {
  return apiRequest<AdminImportedCandidateRejectionDto>(
    `/admin/imported-candidates/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}/rejection`,
    { method: "PUT", token, body: input, fetchImpl },
  );
}

export function restoreAdminImportedCandidate(
  token: string,
  targetType: "kanji" | "word",
  targetId: string,
  fetchImpl?: typeof fetch,
): Promise<AdminRestoreImportedCandidateResponse> {
  return apiRequest<AdminRestoreImportedCandidateResponse>(
    `/admin/imported-candidates/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}/rejection`,
    { method: "DELETE", token, fetchImpl },
  );
}

export function getAdminCompletenessReport(
  token: string,
): Promise<AdminCurriculumCompletenessReportDto> {
  return apiRequest<AdminCurriculumCompletenessReportDto>("/admin/curriculum/completeness", {
    token,
  });
}

export function getAdminScaleReadiness(token: string): Promise<AdminCurriculumScaleReadinessDto> {
  return apiRequest<AdminCurriculumScaleReadinessDto>("/admin/curriculum/scale-readiness", {
    token,
  });
}

export function getAdminCandidatePlan(
  token: string,
  query: {
    readonly itemType: "kanji" | "word";
    readonly offset?: number;
    readonly limit?: number;
    readonly planVersion?: string;
    readonly search?: string;
    readonly band?: CourseBand;
    readonly coverage?: AdminCandidatePlanCoverageFilter;
  },
  fetchImpl?: typeof fetch,
): Promise<AdminCurriculumCandidatePlanResponse> {
  const params = new URLSearchParams({ itemType: query.itemType });

  if (query.offset !== undefined) {
    params.set("offset", String(query.offset));
  }

  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }

  if (query.planVersion !== undefined) {
    params.set("planVersion", query.planVersion);
  }

  if (query.search !== undefined) {
    params.set("search", query.search);
  }

  if (query.band !== undefined) {
    params.set("band", query.band);
  }

  if (query.coverage !== undefined) {
    params.set("coverage", query.coverage);
  }

  return apiRequest<AdminCurriculumCandidatePlanResponse>(
    `/admin/curriculum/candidate-plan?${params.toString()}`,
    { token, fetchImpl },
  );
}

export function enqueueAdminCandidatePlan(
  token: string,
  input: AdminEnqueueCandidatePlanRequest,
  fetchImpl?: typeof fetch,
): Promise<AdminEnqueueCandidatePlanResponse> {
  return apiRequest<AdminEnqueueCandidatePlanResponse>("/admin/curriculum/candidate-plan/enqueue", {
    method: "POST",
    token,
    body: input,
    fetchImpl,
  });
}

export function getAdminCurationItem(token: string, itemId: string): Promise<AdminCurationItemDto> {
  return apiRequest<AdminCurationItemDto>(`/admin/items/${encodeURIComponent(itemId)}`, { token });
}

export function getAdminPrerequisiteCandidates(
  token: string,
  itemId: string,
  fetchImpl?: typeof fetch,
): Promise<AdminPrerequisiteCandidateListResponse> {
  return apiRequest<AdminPrerequisiteCandidateListResponse>(
    `/admin/items/${encodeURIComponent(itemId)}/prerequisite-candidates`,
    { token, fetchImpl },
  );
}

export function updateAdminPrerequisites(
  token: string,
  itemId: string,
  input: AdminUpdatePrerequisitesRequest,
  fetchImpl?: typeof fetch,
): Promise<AdminCurationItemDto> {
  return apiRequest<AdminCurationItemDto>(
    `/admin/items/${encodeURIComponent(itemId)}/prerequisites`,
    { method: "PUT", token, body: input, fetchImpl },
  );
}

export function updateAdminItem(
  token: string,
  itemId: string,
  input: AdminUpdateItemRequest,
): Promise<AdminCurationItemDto> {
  return apiRequest<AdminCurationItemDto>(`/admin/items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    token,
    body: input,
  });
}

export function updateAdminCardAnswers(
  token: string,
  cardId: string,
  input: AdminUpdateCardAnswersRequest,
): Promise<AdminCurationItemDto> {
  return apiRequest<AdminCurationItemDto>(`/admin/cards/${encodeURIComponent(cardId)}/answers`, {
    method: "PATCH",
    token,
    body: input,
  });
}

export function promoteAdminImportedCandidate(
  token: string,
  input: AdminPromoteCandidateRequest,
): Promise<AdminCurationItemDto> {
  return apiRequest<AdminCurationItemDto>("/admin/imported-candidates/promote", {
    method: "POST",
    token,
    body: input,
  });
}

export function approveAdminImportedTranslation(
  token: string,
  input: AdminApproveImportedTranslationRequest,
): Promise<AdminCurationItemDto> {
  return apiRequest<AdminCurationItemDto>("/admin/imported-candidates/approve-translation", {
    method: "POST",
    token,
    body: input,
  });
}

export function getItemDetails(id: string, token?: string | null): Promise<ItemDetails> {
  return apiRequest<ItemDetails>(`/items/${encodeURIComponent(id)}`, { token });
}

export function getKanjiDetails(character: string, token?: string | null): Promise<ItemDetails> {
  return apiRequest<ItemDetails>(`/kanji/${encodeURIComponent(character)}`, { token });
}

export function searchItems(
  query: string,
  token?: string | null,
  fetchImpl?: typeof fetch,
): Promise<SearchResponseDto> {
  const params = new URLSearchParams({ q: query });

  return apiRequest<SearchResponseDto>(`/search?${params.toString()}`, { token, fetchImpl });
}

export function getLessonQueue(
  token: string,
  deckId: string | null = null,
): Promise<LessonQueueResponse> {
  const params = deckId === null ? "" : `?${new URLSearchParams({ deckId }).toString()}`;
  return apiRequest<LessonQueueResponse>(`/lessons/queue${params}`, { token });
}

export function startLessonSession(
  token: string,
  input: StartLessonSessionRequestDto,
): Promise<StartLessonSessionResponse> {
  return apiRequest<StartLessonSessionResponse>("/lessons/start", {
    method: "POST",
    token,
    body: input,
  });
}

export function getActiveLessonSession(token: string): Promise<ActiveLessonSessionResponse> {
  return apiRequest<ActiveLessonSessionResponse>("/lessons/active", { token });
}

export function updateLessonSessionProgress(
  token: string,
  sessionId: string,
  input: UpdateLessonSessionProgressRequestDto,
): Promise<UpdateLessonSessionProgressResponse> {
  return apiRequest<UpdateLessonSessionProgressResponse>(
    `/lessons/${encodeURIComponent(sessionId)}/progress`,
    {
      method: "POST",
      token,
      body: input,
    },
  );
}

export function completeLessonItem(
  token: string,
  sessionId: string,
  input: CompleteLessonItemRequestDto,
): Promise<CompleteLessonItemResponse> {
  return apiRequest<CompleteLessonItemResponse>(
    `/lessons/${encodeURIComponent(sessionId)}/complete-item`,
    {
      method: "POST",
      token,
      body: input,
    },
  );
}

export function checkLessonAnswer(
  token: string,
  sessionId: string,
  input: CheckLessonAnswerRequestDto,
): Promise<CheckLessonAnswerResponse> {
  return apiRequest<CheckLessonAnswerResponse>(
    `/lessons/${encodeURIComponent(sessionId)}/check-answer`,
    {
      method: "POST",
      token,
      body: input,
    },
  );
}

export function finishLessonSession(
  token: string,
  sessionId: string,
): Promise<FinishLessonSessionResponse> {
  return apiRequest<FinishLessonSessionResponse>(
    `/lessons/${encodeURIComponent(sessionId)}/finish`,
    {
      method: "POST",
      token,
    },
  );
}

export function abandonLessonSession(
  token: string,
  sessionId: string,
): Promise<FinishLessonSessionResponse> {
  return apiRequest<FinishLessonSessionResponse>(
    `/lessons/${encodeURIComponent(sessionId)}/abandon`,
    {
      method: "POST",
      token,
    },
  );
}

export function getReviewQueue(token: string): Promise<ReviewQueueResponse> {
  return apiRequest<ReviewQueueResponse>("/reviews/queue", { token });
}

export function getPracticeQueue(
  token: string,
  source: PracticeSource,
): Promise<PracticeQueueResponse> {
  const params = new URLSearchParams({ source });
  return apiRequest<PracticeQueueResponse>(`/reviews/practice/queue?${params.toString()}`, {
    token,
  });
}

export function submitPracticeAnswer(
  token: string,
  request: PracticeAnswerRequest,
): Promise<PracticeAnswerResponse> {
  return apiRequest<PracticeAnswerResponse>("/reviews/practice/answer", {
    method: "POST",
    token,
    body: request,
  });
}

export function createTextDeck(
  token: string,
  input: CreateTextDeckRequest,
  fetchImpl?: typeof fetch,
): Promise<CreateTextDeckResponse> {
  return apiRequest<CreateTextDeckResponse>("/decks/from-text", {
    method: "POST",
    token,
    body: input,
    fetchImpl,
  });
}

export function listDecks(token: string): Promise<DeckListResponse> {
  return apiRequest<DeckListResponse>("/decks", { token });
}

export function getDeck(token: string, deckId: string): Promise<DeckDetailsDto> {
  return apiRequest<DeckDetailsDto>(`/decks/${encodeURIComponent(deckId)}`, { token });
}

export function updateDeckStatus(
  token: string,
  deckId: string,
  input: UpdateDeckStatusRequest,
  fetchImpl?: typeof fetch,
): Promise<DeckDetailsDto> {
  return apiRequest<DeckDetailsDto>(`/decks/${encodeURIComponent(deckId)}/status`, {
    method: "PATCH",
    token,
    body: input,
    fetchImpl,
  });
}

export function startReviewSession(token: string): Promise<StartReviewSessionResponse> {
  return apiRequest<StartReviewSessionResponse>("/reviews/start", {
    method: "POST",
    token,
  });
}

export function submitReviewAnswer(
  token: string,
  sessionId: string,
  request: ReviewAnswerRequest,
): Promise<ReviewAnswerResponse> {
  return apiRequest<ReviewAnswerResponse>(`/reviews/${encodeURIComponent(sessionId)}/answer`, {
    method: "POST",
    token,
    body: request,
  });
}

export function finishReviewSession(
  token: string,
  sessionId: string,
): Promise<FinishReviewSessionResponse> {
  return apiRequest<FinishReviewSessionResponse>(
    `/reviews/${encodeURIComponent(sessionId)}/finish`,
    {
      method: "POST",
      token,
    },
  );
}

export function addPrivateAcceptedAnswer(
  token: string,
  cardId: string,
  input: AddPrivateAcceptedAnswerInput,
): Promise<UserOverrideDto> {
  return apiRequest<UserOverrideDto>(`/cards/${encodeURIComponent(cardId)}/overrides`, {
    method: "POST",
    token,
    body: input,
  });
}

export function deletePrivateAcceptedAnswer(
  token: string,
  cardId: string,
  overrideId: string,
): Promise<DeleteResponse> {
  return apiRequest<DeleteResponse>(
    `/cards/${encodeURIComponent(cardId)}/overrides/${encodeURIComponent(overrideId)}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export function savePrivateMnemonic(
  token: string,
  itemId: string,
  input: SavePrivateMnemonicInput,
): Promise<SavePrivateMnemonicResponse> {
  return apiRequest<SavePrivateMnemonicResponse>(
    `/items/${encodeURIComponent(itemId)}/private-mnemonic`,
    {
      method: "PUT",
      token,
      body: input,
    },
  );
}

export function deletePrivateMnemonic(
  token: string,
  itemId: string,
  input: Omit<SavePrivateMnemonicInput, "body">,
): Promise<DeleteResponse> {
  return apiRequest<DeleteResponse>(`/items/${encodeURIComponent(itemId)}/private-mnemonic`, {
    method: "DELETE",
    token,
    body: input,
  });
}

export function getCurrentUser(token: string): Promise<CurrentUserDto> {
  return apiRequest<CurrentUserDto>("/auth/me", { token });
}

export function updateUserSettings(
  token: string,
  settings: Partial<UserSettingsDto>,
): Promise<CurrentUserDto> {
  return apiRequest<CurrentUserDto>("/users/settings", {
    method: "PATCH",
    token,
    body: settings,
  });
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { readonly message?: unknown };
    const message = payload.message;

    if (Array.isArray(message)) {
      return message.filter((item): item is string => typeof item === "string").join(" ");
    }

    if (typeof message === "string" && message.trim() !== "") {
      return message;
    }
  } catch {
    return "Не удалось получить ответ API.";
  }

  return "Не удалось выполнить запрос.";
}
