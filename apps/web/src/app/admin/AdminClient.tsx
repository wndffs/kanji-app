"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type AdminContentStatus,
  type AdminCoursePlacementListResponse,
  type AdminCurriculumCompletenessReportDto,
  type AdminCurriculumCandidatePlanItemDto,
  type AdminCurationCardDto,
  type AdminCurationItemDto,
  type AdminImportRunSummaryDto,
  type AdminImportedCandidateDto,
  type AdminImportedCandidateDetailsDto,
  type AdminImportedCandidateRejectionDto,
  type AdminImportedCandidateRejectionListItemDto,
  type AdminImportedCandidateRejectionReason,
  type AdminReviewQueueFilters,
  type AdminReviewQueueItemDto,
  type AdminReviewQueueResponse,
  type AdminUpdatePrerequisitesRequest,
  type AdminUpdateCoursePlacementsRequest,
  SUPPORTED_COURSE_BANDS,
  type CourseBand,
} from "@kanji-srs/shared";

import {
  ApiError,
  approveAdminImportedTranslation,
  getAdminCompletenessReport,
  getAdminCurationItem,
  getAdminImportRuns,
  getAdminImportedCandidateDetails,
  getAdminImportedCandidates,
  getAdminImportedCandidateRejections,
  getAdminReviewQueueWithFilters,
  promoteAdminImportedCandidate,
  rejectAdminImportedCandidate,
  restoreAdminImportedCandidate,
  updateAdminCardAnswers,
  updateAdminCoursePlacements,
  updateAdminItem,
  updateAdminPrerequisites,
} from "../../lib/api-client";
import { clearStoredSession, readStoredSession } from "../../lib/auth-storage";
import {
  CandidateRejectionControls,
  type CandidateRejectionTarget,
} from "./CandidateRejectionControls";
import { CurriculumPlanningPanel } from "./CurriculumPlanningPanel";
import { CourseAllocationPanel } from "./CourseAllocationPanel";
import { CoursePlacementEditor } from "./CoursePlacementEditor";
import { CoursePublicationReadinessPanel } from "./CoursePublicationReadinessPanel";
import { CourseEnrollmentRolloutPanel } from "./CourseEnrollmentRolloutPanel";
import { ConfusablePairsPanel } from "./ConfusablePairsPanel";
import { PrerequisiteEditor } from "./PrerequisiteEditor";

type AdminState =
  | { readonly status: "checking" }
  | { readonly status: "unauthenticated" }
  | { readonly status: "forbidden" }
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly token: string;
      readonly queue: readonly AdminReviewQueueItemDto[];
      readonly queuePagination: AdminReviewQueueResponse["pagination"];
      readonly importedCandidates: readonly AdminImportedCandidateDto[];
      readonly candidateRejections: readonly AdminImportedCandidateRejectionListItemDto[];
      readonly importRuns: readonly AdminImportRunSummaryDto[];
      readonly report: AdminCurriculumCompletenessReportDto;
      readonly item: AdminCurationItemDto | null;
    };

type AdminFilters = {
  readonly band: "" | CourseBand;
  readonly jlptLevel: "" | "N5" | "N4" | "N3" | "N2";
  readonly status: AdminContentStatus;
  readonly missingAcceptedAnswers: boolean;
  readonly missingMnemonics: boolean;
};

type ItemDraft = {
  readonly status: AdminContentStatus;
  readonly band: "" | CourseBand;
  readonly meaningRu: string;
  readonly meaningEn: string;
  readonly hintRu: string;
  readonly hintEn: string;
  readonly mnemonicRu: string;
  readonly mnemonicEn: string;
};

type CardDraft = {
  readonly acceptedRu: string;
  readonly acceptedEn: string;
  readonly blocked: string;
  readonly blockedReason: string;
};

type PromoteDraft = {
  readonly targetType: "component" | "kanji" | "word" | "sentence";
  readonly targetId: string;
  readonly title: string;
  readonly band: CourseBand;
  readonly level: string;
};

type TranslationReviewDraft = {
  readonly targetType: "kanji" | "word";
  readonly targetId: string;
  readonly title: string;
  readonly band: CourseBand;
  readonly level: string;
  readonly meaningRu: string;
  readonly meaningEn: string;
  readonly acceptedRu: string;
  readonly acceptedEn: string;
  readonly acceptedReadings: string;
};

export function AdminClient() {
  const translationReviewRef = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<AdminState>({ status: "checking" });
  const [filters, setFilters] = useState<AdminFilters>(DEFAULT_FILTERS);
  const [itemDraft, setItemDraft] = useState<ItemDraft>(EMPTY_ITEM_DRAFT);
  const [cardDrafts, setCardDrafts] = useState<Record<string, CardDraft>>({});
  const [promoteDraft, setPromoteDraft] = useState<PromoteDraft>(EMPTY_PROMOTE_DRAFT);
  const [translationDraft, setTranslationDraft] = useState<TranslationReviewDraft>(
    EMPTY_TRANSLATION_REVIEW_DRAFT,
  );
  const [translationDetails, setTranslationDetails] =
    useState<AdminImportedCandidateDetailsDto | null>(null);
  const [planningRevision, setPlanningRevision] = useState(0);
  const [queueCursor, setQueueCursor] = useState<string | null>(null);
  const [queueCursorHistory, setQueueCursorHistory] = useState<readonly (string | null)[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const syncDrafts = useCallback((item: AdminCurationItemDto | null) => {
    if (item === null) {
      setItemDraft(EMPTY_ITEM_DRAFT);
      setCardDrafts({});
      return;
    }

    setItemDraft(buildItemDraft(item));
    setCardDrafts(buildCardDrafts(item.cards));
  }, []);

  const loadAdmin = useCallback(async () => {
    const session = readStoredSession();

    if (session === null) {
      setState({ status: "unauthenticated" });
      return;
    }

    if (session.user.role !== "ADMIN") {
      setState({ status: "forbidden" });
      return;
    }

    setState({ status: "loading" });
    setFormError(null);
    setStatusMessage(null);

    try {
      const [queue, importRuns, importedCandidates, candidateRejections, report] =
        await Promise.all([
          getAdminReviewQueueWithFilters(session.token, {
            ...toApiFilters(filters),
            limit: ADMIN_REVIEW_QUEUE_PAGE_LIMIT,
          }),
          getAdminImportRuns(session.token),
          getAdminImportedCandidates(session.token),
          getAdminImportedCandidateRejections(session.token),
          getAdminCompletenessReport(session.token),
        ]);
      const firstItem =
        queue.items.length === 0
          ? null
          : await getAdminCurationItem(session.token, queue.items[0].id);
      const firstTranslationCandidate = importedCandidates.candidates.find(isBilingualCandidate);

      syncDrafts(firstItem);
      setTranslationDetails(null);
      setTranslationDraft(
        firstTranslationCandidate === undefined
          ? EMPTY_TRANSLATION_REVIEW_DRAFT
          : buildTranslationReviewDraftFromCandidate(firstTranslationCandidate),
      );
      setState({
        status: "ready",
        token: session.token,
        queue: queue.items,
        queuePagination: queue.pagination,
        importedCandidates: importedCandidates.candidates,
        candidateRejections: candidateRejections.rejections,
        importRuns: importRuns.importRuns,
        report,
        item: firstItem,
      });
      setQueueCursor(null);
      setQueueCursorHistory([]);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        clearStoredSession();
        setState({ status: "unauthenticated" });
        return;
      }

      if (error instanceof ApiError && error.status === 403) {
        setState({ status: "forbidden" });
        return;
      }

      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Не удалось загрузить админку.",
      });
    }
  }, [filters, syncDrafts]);

  useEffect(() => {
    void loadAdmin();
  }, [loadAdmin]);

  const activeItem = state.status === "ready" ? state.item : null;
  const sourceNames = useMemo(() => {
    if (activeItem === null) {
      return "";
    }

    return activeItem.attributions.map((source) => source.sourceName).join(", ");
  }, [activeItem]);
  const translationReviewCandidates = useMemo(
    () => (state.status === "ready" ? state.importedCandidates.filter(isBilingualCandidate) : []),
    [state],
  );
  const activeTranslationCandidate = useMemo(
    () =>
      translationReviewCandidates.find(
        (candidate) =>
          candidate.targetId === translationDraft.targetId &&
          candidate.itemType === translationDraft.targetType,
      ) ?? null,
    [translationDraft.targetId, translationDraft.targetType, translationReviewCandidates],
  );
  const activeTranslationDetails =
    translationDetails?.targetId === translationDraft.targetId &&
    translationDetails.itemType === translationDraft.targetType
      ? translationDetails
      : null;
  const activeTranslationSource = activeTranslationDetails ?? activeTranslationCandidate;

  async function handleQueuePage(
    nextCursor: string | null,
    direction: "next" | "previous",
  ): Promise<void> {
    if (state.status !== "ready" || savingKey !== null) {
      return;
    }

    setSavingKey("queue-page");
    setFormError(null);
    setStatusMessage(null);

    try {
      const queue = await getAdminReviewQueueWithFilters(state.token, {
        ...toApiFilters(filters),
        limit: ADMIN_REVIEW_QUEUE_PAGE_LIMIT,
        ...(nextCursor === null ? {} : { cursor: nextCursor }),
      });
      const firstItem =
        queue.items.length === 0
          ? null
          : await getAdminCurationItem(state.token, queue.items[0].id);

      syncDrafts(firstItem);
      setState({
        ...state,
        queue: queue.items,
        queuePagination: queue.pagination,
        item: firstItem,
      });
      setQueueCursor(nextCursor);
      setQueueCursorHistory((previous) =>
        direction === "next" ? [...previous, queueCursor] : previous.slice(0, -1),
      );
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Не удалось открыть страницу очереди.");
    } finally {
      setSavingKey(null);
    }
  }

  async function refreshQueueFromStart(): Promise<void> {
    if (state.status !== "ready") {
      return;
    }

    try {
      const queue = await getAdminReviewQueueWithFilters(state.token, {
        ...toApiFilters(filters),
        limit: ADMIN_REVIEW_QUEUE_PAGE_LIMIT,
      });
      const firstItem =
        queue.items.length === 0
          ? null
          : await getAdminCurationItem(state.token, queue.items[0].id);

      syncDrafts(firstItem);
      setState({
        ...state,
        queue: queue.items,
        queuePagination: queue.pagination,
        item: firstItem,
      });
      setQueueCursor(null);
      setQueueCursorHistory([]);
    } catch (error: unknown) {
      setFormError(
        error instanceof Error ? error.message : "Не удалось обновить очередь проверки.",
      );
    }
  }

  async function handleSelectItem(itemId: string): Promise<void> {
    if (state.status !== "ready" || savingKey !== null) {
      return;
    }

    setSavingKey(`load:${itemId}`);
    setFormError(null);
    setStatusMessage(null);

    try {
      const item = await getAdminCurationItem(state.token, itemId);
      syncDrafts(item);
      setState({ ...state, item });
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Не удалось открыть материал.");
    } finally {
      setSavingKey(null);
    }
  }

  async function reconcileQueueAfterSave(
    savedItem: AdminCurationItemDto,
    savedMessage: string,
  ): Promise<void> {
    if (state.status !== "ready") {
      return;
    }

    const token = state.token;
    setPlanningRevision((previous) => previous + 1);

    try {
      const [queue, report] = await Promise.all([
        getAdminReviewQueueWithFilters(token, {
          ...toApiFilters(filters),
          limit: ADMIN_REVIEW_QUEUE_PAGE_LIMIT,
        }),
        getAdminCompletenessReport(token),
      ]);
      const firstQueueItem = queue.items[0];
      const nextItem =
        firstQueueItem === undefined
          ? null
          : firstQueueItem.id === savedItem.id
            ? savedItem
            : await getAdminCurationItem(token, firstQueueItem.id);

      syncDrafts(nextItem);
      setState((current) =>
        current.status === "ready"
          ? {
              ...current,
              queue: queue.items,
              queuePagination: queue.pagination,
              report,
              item: nextItem,
            }
          : current,
      );
      setQueueCursor(null);
      setQueueCursorHistory([]);
      setStatusMessage(
        nextItem === null
          ? `${savedMessage} Текущая очередь пуста.`
          : nextItem.id === savedItem.id
            ? savedMessage
            : `${savedMessage} Открыт следующий материал.`,
      );
    } catch (error: unknown) {
      syncDrafts(savedItem);
      setState((current) =>
        current.status === "ready" ? { ...current, item: savedItem } : current,
      );
      setStatusMessage(savedMessage);
      setFormError(
        error instanceof Error
          ? `Изменения сохранены, но очередь не обновилась: ${error.message}`
          : "Изменения сохранены, но очередь не обновилась. Обновите страницу.",
      );
    }
  }

  async function handleSaveItem(
    event: FormEvent<HTMLFormElement> | null,
    nextStatus?: AdminContentStatus,
  ): Promise<void> {
    event?.preventDefault();

    if (state.status !== "ready" || state.item === null || savingKey !== null) {
      return;
    }

    setSavingKey("item");
    setFormError(null);
    setStatusMessage(null);

    try {
      const item = await updateAdminItem(state.token, state.item.id, {
        status: nextStatus ?? itemDraft.status,
        band: itemDraft.band === "" ? null : itemDraft.band,
        meanings: {
          ru: itemDraft.meaningRu,
          en: itemDraft.meaningEn,
        },
        hints: [
          { locale: "ru-RU", type: "meaning", body: itemDraft.hintRu },
          { locale: "en-US", type: "meaning", body: itemDraft.hintEn },
        ],
        mnemonics: [
          { locale: "ru-RU", type: "story", body: itemDraft.mnemonicRu },
          { locale: "en-US", type: "story", body: itemDraft.mnemonicEn },
        ],
      });

      await reconcileQueueAfterSave(item, "Материал сохранён.");
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Не удалось сохранить материал.");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSavePrerequisites(request: AdminUpdatePrerequisitesRequest): Promise<void> {
    if (state.status !== "ready" || state.item === null || savingKey !== null) {
      return;
    }

    setSavingKey("prerequisites");
    setFormError(null);
    setStatusMessage(null);

    try {
      const item = await updateAdminPrerequisites(state.token, state.item.id, request);
      await reconcileQueueAfterSave(item, "Предварительные связи сохранены.");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSaveCoursePlacements(
    request: AdminUpdateCoursePlacementsRequest,
  ): Promise<AdminCoursePlacementListResponse> {
    if (state.status !== "ready" || state.item === null || savingKey !== null) {
      throw new Error("Редактор размещения сейчас недоступен.");
    }

    setSavingKey("course-placements");
    setFormError(null);
    setStatusMessage(null);

    try {
      const placements = await updateAdminCoursePlacements(state.token, state.item.id, request);
      setStatusMessage("Размещение в курсе сохранено.");
      return placements;
    } finally {
      setSavingKey(null);
    }
  }

  async function handlePromoteCandidate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (state.status !== "ready" || savingKey !== null) {
      return;
    }

    const targetId = promoteDraft.targetId.trim();
    const title = promoteDraft.title.trim();
    const levelText = promoteDraft.level.trim();
    const level = levelText === "" ? null : Number(levelText);

    if (targetId === "" || title === "") {
      setFormError("Укажите target ID и название кандидата.");
      return;
    }

    if (level !== null && (!Number.isInteger(level) || level <= 0)) {
      setFormError("Level must be a positive integer.");
      return;
    }

    setSavingKey("promote");
    setFormError(null);
    setStatusMessage(null);

    try {
      const item = await promoteAdminImportedCandidate(state.token, {
        targetType: promoteDraft.targetType,
        targetId,
        title,
        band: promoteDraft.band,
        level,
      });
      const [queue, importedCandidates, report] = await Promise.all([
        getAdminReviewQueueWithFilters(state.token, {
          ...toApiFilters(filters),
          limit: ADMIN_REVIEW_QUEUE_PAGE_LIMIT,
        }),
        getAdminImportedCandidates(state.token),
        getAdminCompletenessReport(state.token),
      ]);

      syncDrafts(item);
      setState({
        ...state,
        queue: queue.items,
        queuePagination: queue.pagination,
        importedCandidates: importedCandidates.candidates,
        report,
        item,
      });
      setPromoteDraft(EMPTY_PROMOTE_DRAFT);
      setQueueCursor(null);
      setQueueCursorHistory([]);
      setPlanningRevision((previous) => previous + 1);
      setStatusMessage("Кандидат добавлен в кураторскую очередь.");
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Не удалось продвинуть кандидата.");
    } finally {
      setSavingKey(null);
    }
  }

  function handleSelectImportedCandidate(candidate: AdminImportedCandidateDto): void {
    setPromoteDraft({
      targetType: candidate.itemType,
      targetId: candidate.targetId,
      title: candidate.suggestedTitle,
      band: candidate.suggestedBand,
      level: "",
    });
    setFormError(null);
    setStatusMessage(`Кандидат ${candidate.japanese} выбран для подготовки.`);
  }

  function handleSelectTranslationCandidate(candidate: AdminImportedCandidateDto): void {
    setTranslationDetails(null);
    setTranslationDraft(buildTranslationReviewDraftFromCandidate(candidate));
    setFormError(null);
    setStatusMessage(null);
  }

  async function handleReviewPlannedCandidate(
    candidate: AdminCurriculumCandidatePlanItemDto,
  ): Promise<void> {
    if (state.status !== "ready" || savingKey !== null) {
      return;
    }

    setSavingKey(`candidate-details:${candidate.itemType}:${candidate.targetId}`);
    setFormError(null);
    setStatusMessage(null);

    try {
      const details = await getAdminImportedCandidateDetails(
        state.token,
        candidate.itemType,
        candidate.targetId,
      );

      setTranslationDetails(details);
      setTranslationDraft(buildTranslationReviewDraftFromDetails(details, candidate.suggestedBand));
      setStatusMessage(`Кандидат ${details.japanese} открыт для проверки перевода.`);
      requestAnimationFrame(() => {
        translationReviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } finally {
      setSavingKey(null);
    }
  }

  async function handleApproveTranslation(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (state.status !== "ready" || savingKey !== null || translationDraft.targetId === "") {
      return;
    }

    const levelText = translationDraft.level.trim();
    const level = levelText === "" ? null : Number(levelText);
    const acceptedRu = splitLines(translationDraft.acceptedRu);
    const acceptedEn = splitLines(translationDraft.acceptedEn);
    const acceptedReadings = splitLines(translationDraft.acceptedReadings);

    if (level !== null && (!Number.isInteger(level) || level <= 0)) {
      setFormError("Уровень должен быть положительным целым числом.");
      return;
    }

    if (acceptedRu.length === 0 || acceptedEn.length === 0) {
      setFormError("Добавьте хотя бы один принятый ответ на русском и английском.");
      return;
    }

    if (acceptedReadings.length === 0) {
      setFormError("Добавьте хотя бы одно проверенное чтение.");
      return;
    }

    setSavingKey("translation-review");
    setFormError(null);
    setStatusMessage(null);

    try {
      const item = await approveAdminImportedTranslation(state.token, {
        targetType: translationDraft.targetType,
        targetId: translationDraft.targetId,
        title: translationDraft.title.trim(),
        band: translationDraft.band,
        level,
        meanings: {
          ru: translationDraft.meaningRu.trim(),
          en: translationDraft.meaningEn.trim(),
        },
        acceptedAnswers: { ru: acceptedRu, en: acceptedEn },
        acceptedReadings,
      });
      const [queue, importedCandidates, report] = await Promise.all([
        getAdminReviewQueueWithFilters(state.token, {
          ...toApiFilters(filters),
          limit: ADMIN_REVIEW_QUEUE_PAGE_LIMIT,
        }),
        getAdminImportedCandidates(state.token),
        getAdminCompletenessReport(state.token),
      ]);
      const nextCandidate = importedCandidates.candidates.find(isBilingualCandidate);

      syncDrafts(item);
      setTranslationDetails(null);
      setTranslationDraft(
        nextCandidate === undefined
          ? EMPTY_TRANSLATION_REVIEW_DRAFT
          : buildTranslationReviewDraftFromCandidate(nextCandidate),
      );
      setState({
        ...state,
        queue: queue.items,
        queuePagination: queue.pagination,
        importedCandidates: importedCandidates.candidates,
        report,
        item,
      });
      setPlanningRevision((previous) => previous + 1);
      setQueueCursor(null);
      setQueueCursorHistory([]);
      setStatusMessage("Перевод подтверждён и добавлен в кураторскую очередь.");
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Не удалось подтвердить перевод.");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleRejectCandidate(
    candidate: CandidateRejectionTarget,
    reason: AdminImportedCandidateRejectionReason,
    note: string | null,
  ): Promise<boolean> {
    if (state.status !== "ready" || savingKey !== null) {
      return false;
    }

    setSavingKey("candidate-rejection");
    setFormError(null);
    setStatusMessage(null);

    let rejection: AdminImportedCandidateRejectionDto;

    try {
      rejection = await rejectAdminImportedCandidate(
        state.token,
        candidate.itemType,
        candidate.targetId,
        { reason, note },
      );
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Не удалось отклонить кандидата.");
      setSavingKey(null);
      return false;
    }

    const remainingCandidates = state.importedCandidates.filter(
      (item) => item.itemType !== candidate.itemType || item.targetId !== candidate.targetId,
    );
    const nextCandidate = remainingCandidates.find(isBilingualCandidate);
    const localRejection: AdminImportedCandidateRejectionListItemDto = {
      ...rejection,
      japanese: candidate.japanese,
      reading: candidate.reading,
    };

    setState({
      ...state,
      importedCandidates: remainingCandidates,
      candidateRejections: [
        localRejection,
        ...state.candidateRejections.filter((item) => item.id !== localRejection.id),
      ],
    });
    setTranslationDetails(null);
    setTranslationDraft(
      nextCandidate === undefined
        ? EMPTY_TRANSLATION_REVIEW_DRAFT
        : buildTranslationReviewDraftFromCandidate(nextCandidate),
    );
    setPlanningRevision((previous) => previous + 1);
    setStatusMessage(`Кандидат ${candidate.japanese} отклонён и исключён из новых планов.`);

    try {
      const [importedCandidates, candidateRejections] = await Promise.all([
        getAdminImportedCandidates(state.token),
        getAdminImportedCandidateRejections(state.token),
      ]);
      const refreshedNextCandidate = importedCandidates.candidates.find(isBilingualCandidate);

      setState((current) =>
        current.status === "ready"
          ? {
              ...current,
              importedCandidates: importedCandidates.candidates,
              candidateRejections: candidateRejections.rejections,
            }
          : current,
      );
      setTranslationDraft(
        refreshedNextCandidate === undefined
          ? EMPTY_TRANSLATION_REVIEW_DRAFT
          : buildTranslationReviewDraftFromCandidate(refreshedNextCandidate),
      );
    } catch (error: unknown) {
      setFormError(
        `Решение сохранено, но списки не обновились: ${error instanceof Error ? error.message : "неизвестная ошибка"}`,
      );
    } finally {
      setSavingKey(null);
    }

    return true;
  }

  async function handleRestoreCandidate(
    rejection: AdminImportedCandidateRejectionListItemDto,
  ): Promise<void> {
    if (state.status !== "ready" || savingKey !== null) {
      return;
    }

    setSavingKey(`candidate-restore:${rejection.id}`);
    setFormError(null);
    setStatusMessage(null);

    try {
      const result = await restoreAdminImportedCandidate(
        state.token,
        rejection.targetType,
        rejection.targetId,
      );

      setState((current) =>
        current.status === "ready"
          ? {
              ...current,
              candidateRejections: current.candidateRejections.filter(
                (item) => item.id !== rejection.id,
              ),
            }
          : current,
      );
      setPlanningRevision((previous) => previous + 1);
      setStatusMessage(
        result.restored
          ? `Кандидат ${rejection.japanese ?? rejection.targetId} восстановлен.`
          : "Кандидат уже был восстановлен.",
      );

      try {
        const [importedCandidates, candidateRejections] = await Promise.all([
          getAdminImportedCandidates(state.token),
          getAdminImportedCandidateRejections(state.token),
        ]);

        setState((current) =>
          current.status === "ready"
            ? {
                ...current,
                importedCandidates: importedCandidates.candidates,
                candidateRejections: candidateRejections.rejections,
              }
            : current,
        );

        if (translationDraft.targetId === "") {
          const nextCandidate = importedCandidates.candidates.find(isBilingualCandidate);

          if (nextCandidate !== undefined) {
            setTranslationDraft(buildTranslationReviewDraftFromCandidate(nextCandidate));
          }
        }
      } catch (error: unknown) {
        setFormError(
          `Кандидат восстановлен, но списки не обновились: ${error instanceof Error ? error.message : "неизвестная ошибка"}`,
        );
      }
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Не удалось восстановить кандидата.");
    } finally {
      setSavingKey(null);
    }
  }

  async function handleSaveCard(card: AdminCurationCardDto): Promise<void> {
    if (state.status !== "ready" || state.item === null || savingKey !== null) {
      return;
    }

    const draft = cardDrafts[card.id] ?? EMPTY_CARD_DRAFT;

    setSavingKey(card.id);
    setFormError(null);
    setStatusMessage(null);

    try {
      const item = await updateAdminCardAnswers(state.token, card.id, {
        acceptedAnswers: [
          ...splitLines(draft.acceptedRu).map((text, index) => ({
            locale: "ru-RU" as const,
            text,
            answerKind: card.answerType,
            isPrimary: index === 0,
          })),
          ...splitLines(draft.acceptedEn).map((text, index) => ({
            locale: "en-US" as const,
            text,
            answerKind: card.answerType,
            isPrimary: index === 0,
          })),
        ],
        blockedAnswers: splitLines(draft.blocked).map((text) => ({
          text,
          reason: draft.blockedReason.trim() === "" ? null : draft.blockedReason.trim(),
        })),
      });

      await reconcileQueueAfterSave(item, "Ответы карточки сохранены.");
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "Не удалось сохранить ответы.");
    } finally {
      setSavingKey(null);
    }
  }

  if (state.status === "checking" || state.status === "loading") {
    return (
      <section className="page-stack" aria-busy="true">
        <div className="page-heading">
          <h1>Админка</h1>
          <p>Загружаю очередь проверки.</p>
        </div>
        <div className="admin-layout">
          <div className="panel skeleton" />
          <div className="panel skeleton" />
        </div>
      </section>
    );
  }

  if (state.status === "unauthenticated") {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Админка</h1>
          <p>Нужен вход в аккаунт администратора.</p>
        </div>
        <div className="notice-panel">
          <Link className="primary-action" href="/login">
            Войти
          </Link>
        </div>
      </section>
    );
  }

  if (state.status === "forbidden") {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Админка</h1>
          <p>Недостаточно прав для редактирования контента.</p>
        </div>
        <div className="notice-panel error-panel">
          <p>Обычный пользователь не может открыть административные экраны.</p>
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="page-stack">
        <div className="page-heading">
          <h1>Админка</h1>
          <p>API недоступен.</p>
        </div>
        <div className="notice-panel error-panel">
          <p>{state.message}</p>
          <button className="secondary-action" onClick={() => void loadAdmin()} type="button">
            Повторить
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="page-stack">
      <div className="page-heading admin-heading">
        <div>
          <h1>Админка</h1>
          <p>Кураторская правка закрытого учебного контента.</p>
        </div>
        {activeItem === null ? null : (
          <div className="action-row">
            <button
              className="secondary-action"
              disabled={savingKey !== null}
              onClick={() => void handleSaveItem(null, "needs-review")}
              type="button"
            >
              Снять с публикации
            </button>
            <button
              className="primary-action"
              disabled={savingKey !== null}
              onClick={() => void handleSaveItem(null, "published")}
              type="button"
            >
              Опубликовать
            </button>
          </div>
        )}
      </div>

      {statusMessage === null ? null : <p className="success-text">{statusMessage}</p>}
      {formError === null ? null : <p className="form-error">{formError}</p>}

      <section className="panel admin-form" aria-label="Фильтры учебной программы">
        <h2>Фильтры курса</h2>
        <div className="admin-two-column">
          <label>
            Band
            <select
              onChange={(event) => {
                const band = event.currentTarget.value as AdminFilters["band"];
                setFilters((previous) => ({ ...previous, band }));
              }}
              value={filters.band}
            >
              <option value="">Все</option>
              <option value="foundation">Foundation</option>
              <option value="n5">N5</option>
              <option value="n4">N4</option>
              <option value="n3">N3</option>
              <option value="n2">N2</option>
            </select>
          </label>
          <label>
            JLPT
            <select
              onChange={(event) => {
                const jlptLevel = event.currentTarget.value as AdminFilters["jlptLevel"];
                setFilters((previous) => ({ ...previous, jlptLevel }));
              }}
              value={filters.jlptLevel}
            >
              <option value="">Все</option>
              <option value="N5">N5</option>
              <option value="N4">N4</option>
              <option value="N3">N3</option>
              <option value="N2">N2</option>
            </select>
          </label>
        </div>
        <div className="admin-two-column">
          <label>
            Статус
            <select
              onChange={(event) => {
                const status = event.currentTarget.value as AdminContentStatus;
                setFilters((previous) => ({ ...previous, status }));
              }}
              value={filters.status}
            >
              <option value="draft">Черновик</option>
              <option value="needs-review">Нужна проверка</option>
              <option value="published">Опубликовано</option>
              <option value="archived">Архив</option>
            </select>
          </label>
          <div className="admin-filter-flags">
            <label className="checkbox-row">
              <input
                checked={filters.missingAcceptedAnswers}
                onChange={(event) => {
                  const missingAcceptedAnswers = event.currentTarget.checked;
                  setFilters((previous) => ({ ...previous, missingAcceptedAnswers }));
                }}
                type="checkbox"
              />
              Нет правильных ответов
            </label>
            <label className="checkbox-row">
              <input
                checked={filters.missingMnemonics}
                onChange={(event) => {
                  const missingMnemonics = event.currentTarget.checked;
                  setFilters((previous) => ({ ...previous, missingMnemonics }));
                }}
                type="checkbox"
              />
              Нет мнемоник
            </label>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Completeness by band</h2>
        <div className="admin-completeness-grid">
          {state.report.bands.map((band) => (
            <article key={band.band}>
              <strong>{formatBand(band.band)}</strong>
              <dl>
                <div>
                  <dt>Всего</dt>
                  <dd>{band.totalItems}</dd>
                </div>
                <div>
                  <dt>Опубликовано</dt>
                  <dd>{band.publishedItems}</dd>
                </div>
                <div>
                  <dt>Нет ответов</dt>
                  <dd>{band.missingAcceptedAnswers}</dd>
                </div>
                <div>
                  <dt>Нет мнемоник</dt>
                  <dd>{band.missingMnemonics}</dd>
                </div>
                <div>
                  <dt>Нет RU/EN</dt>
                  <dd>{band.missingLocaleCoverage}</dd>
                </div>
                <div>
                  <dt>Связи</dt>
                  <dd>{band.invalidDependencies}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <ConfusablePairsPanel token={state.token} />

      <CurriculumPlanningPanel
        disabled={savingKey !== null}
        key={state.token}
        onQueueChanged={refreshQueueFromStart}
        onReviewCandidate={handleReviewPlannedCandidate}
        refreshRevision={planningRevision}
        selectedCandidateKey={
          translationDraft.targetId === ""
            ? null
            : `${translationDraft.targetType}:${translationDraft.targetId}`
        }
        token={state.token}
      />

      <CourseAllocationPanel
        disabled={savingKey !== null}
        onApplied={(createdPlacements) => {
          setStatusMessage(`Распределение применено. Создано размещений: ${createdPlacements}.`);
          setPlanningRevision((previous) => previous + 1);
        }}
        refreshRevision={planningRevision}
        token={state.token}
      />

      <CoursePublicationReadinessPanel
        disabled={savingKey !== null}
        onPublished={(statusChanged) => {
          setStatusMessage(
            statusChanged
              ? "Основной курс опубликован. Зачисления пользователей не изменены."
              : "Основной курс уже был опубликован.",
          );
          setPlanningRevision((previous) => previous + 1);
        }}
        refreshRevision={planningRevision}
        token={state.token}
      />

      <CourseEnrollmentRolloutPanel
        disabled={savingKey !== null}
        onApplied={(createdEnrollments) => {
          setStatusMessage(
            `Основной курс добавлен учащимся: ${createdEnrollments}. Демо-курс и прогресс сохранены.`,
          );
          setPlanningRevision((previous) => previous + 1);
        }}
        refreshRevision={planningRevision}
        token={state.token}
      />

      <section
        className="panel admin-translation-review"
        data-testid="admin-translation-review"
        ref={translationReviewRef}
      >
        <div className="admin-translation-review-heading">
          <div>
            <span className="eyebrow">RU + EN</span>
            <h2>Проверка переводов</h2>
          </div>
          <strong>{translationReviewCandidates.length}</strong>
        </div>
        {translationReviewCandidates.length === 0 && activeTranslationSource === null ? (
          <p className="muted">Кандидатов с русским и английским переводом пока нет.</p>
        ) : (
          <div className="admin-translation-workspace">
            {translationReviewCandidates.length === 0 ? (
              <p className="muted">Быстрая очередь пуста.</p>
            ) : (
              <ol className="admin-translation-queue-list">
                {translationReviewCandidates.map((candidate) => (
                  <li key={`${candidate.itemType}:${candidate.targetId}`}>
                    <button
                      aria-current={
                        translationDraft.targetId === candidate.targetId ? "true" : undefined
                      }
                      disabled={savingKey !== null}
                      onClick={() => handleSelectTranslationCandidate(candidate)}
                      type="button"
                    >
                      <span>
                        <strong>{candidate.japanese}</strong>
                        <b>#{candidate.rank}</b>
                      </span>
                      <small>{candidate.reading ?? "без чтения"}</small>
                      <small>{candidate.meanings.ru.join(", ")}</small>
                    </button>
                  </li>
                ))}
              </ol>
            )}

            <form
              className="admin-translation-form"
              onSubmit={(event) => void handleApproveTranslation(event)}
            >
              <header>
                <div>
                  <span className="eyebrow">{formatItemType(translationDraft.targetType)}</span>
                  <h3>{activeTranslationSource?.japanese}</h3>
                </div>
                <span>{activeTranslationSource?.reading ?? ""}</span>
              </header>

              <div className="admin-translation-source-grid">
                <div>
                  <span>Импорт RU</span>
                  <p>{activeTranslationSource?.meanings.ru.join(" · ") || "нет"}</p>
                </div>
                <div>
                  <span>Import EN</span>
                  <p>{activeTranslationSource?.meanings.en.join(" · ") || "нет"}</p>
                </div>
              </div>

              {activeTranslationDetails === null ? null : (
                <dl
                  className="admin-translation-provenance"
                  data-testid="admin-translation-provenance"
                >
                  <div>
                    <dt>Чтения</dt>
                    <dd>{formatImportedReadings(activeTranslationDetails)}</dd>
                  </div>
                  <div>
                    <dt>Источник</dt>
                    <dd>
                      {activeTranslationDetails.source.sourceUrl === null ? (
                        activeTranslationDetails.source.name
                      ) : (
                        <a
                          href={activeTranslationDetails.source.sourceUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {activeTranslationDetails.source.name}
                        </a>
                      )}{" "}
                      · {activeTranslationDetails.source.licenseName}
                    </dd>
                  </div>
                  <div>
                    <dt>Запись</dt>
                    <dd>{activeTranslationDetails.source.sourceRecordId}</dd>
                  </div>
                  <div>
                    <dt>Import run</dt>
                    <dd>{activeTranslationDetails.source.importRunId}</dd>
                  </div>
                  <div>
                    <dt>Снимок</dt>
                    <dd>
                      {activeTranslationDetails.source.sourceFileName}
                      {activeTranslationDetails.source.sourceVersion === null
                        ? ""
                        : ` · ${activeTranslationDetails.source.sourceVersion}`}
                    </dd>
                  </div>
                  <div>
                    <dt>SHA-256</dt>
                    <dd>{activeTranslationDetails.source.checksumSha256}</dd>
                  </div>
                  <div className="admin-translation-attribution">
                    <dt>Атрибуция</dt>
                    <dd>{activeTranslationDetails.source.attributionText}</dd>
                  </div>
                </dl>
              )}

              <label>
                Название материала
                <input
                  onChange={(event) => {
                    const title = event.currentTarget.value;
                    setTranslationDraft((previous) => ({ ...previous, title }));
                  }}
                  required
                  value={translationDraft.title}
                />
              </label>

              <div className="admin-two-column">
                <label>
                  Учебное значение RU
                  <input
                    data-testid="translation-meaning-ru"
                    onChange={(event) => {
                      const meaningRu = event.currentTarget.value;
                      setTranslationDraft((previous) => ({ ...previous, meaningRu }));
                    }}
                    required
                    value={translationDraft.meaningRu}
                  />
                </label>
                <label>
                  Learning meaning EN
                  <input
                    data-testid="translation-meaning-en"
                    onChange={(event) => {
                      const meaningEn = event.currentTarget.value;
                      setTranslationDraft((previous) => ({ ...previous, meaningEn }));
                    }}
                    required
                    value={translationDraft.meaningEn}
                  />
                </label>
              </div>

              <div className="admin-two-column">
                <label>
                  Принятые ответы RU
                  <textarea
                    data-testid="translation-accepted-ru"
                    onChange={(event) => {
                      const acceptedRu = event.currentTarget.value;
                      setTranslationDraft((previous) => ({ ...previous, acceptedRu }));
                    }}
                    value={translationDraft.acceptedRu}
                  />
                </label>
                <label>
                  Accepted answers EN
                  <textarea
                    data-testid="translation-accepted-en"
                    onChange={(event) => {
                      const acceptedEn = event.currentTarget.value;
                      setTranslationDraft((previous) => ({ ...previous, acceptedEn }));
                    }}
                    value={translationDraft.acceptedEn}
                  />
                </label>
              </div>

              <label className="admin-translation-readings">
                Принятые чтения · первое основное
                <textarea
                  data-testid="translation-accepted-readings"
                  onChange={(event) => {
                    const acceptedReadings = event.currentTarget.value;
                    setTranslationDraft((previous) => ({ ...previous, acceptedReadings }));
                  }}
                  required
                  value={translationDraft.acceptedReadings}
                />
              </label>

              <div className="admin-translation-meta">
                <label>
                  Band
                  <select
                    onChange={(event) => {
                      const band = event.currentTarget.value as CourseBand;
                      setTranslationDraft((previous) => ({ ...previous, band }));
                    }}
                    value={translationDraft.band}
                  >
                    {SUPPORTED_COURSE_BANDS.map((band) => (
                      <option key={band} value={band}>
                        {formatBand(band)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Уровень
                  <input
                    inputMode="numeric"
                    onChange={(event) => {
                      const level = event.currentTarget.value;
                      setTranslationDraft((previous) => ({ ...previous, level }));
                    }}
                    value={translationDraft.level}
                  />
                </label>
                <button className="primary-action" disabled={savingKey !== null} type="submit">
                  Подтвердить перевод
                </button>
              </div>
            </form>
          </div>
        )}

        <CandidateRejectionControls
          candidate={activeTranslationSource}
          disabled={savingKey !== null}
          onReject={handleRejectCandidate}
          onRestore={handleRestoreCandidate}
          rejections={state.candidateRejections}
          restoringId={
            savingKey?.startsWith("candidate-restore:") === true
              ? savingKey.slice("candidate-restore:".length)
              : null
          }
        />
      </section>

      <div className="admin-layout">
        <aside className="panel admin-queue">
          <h2>Нужны правки</h2>
          {state.queue.length === 0 ? (
            <p className="muted">Материалов в очереди проверки нет.</p>
          ) : (
            <ul>
              {state.queue.map((item) => (
                <li key={item.id}>
                  <button
                    aria-current={activeItem?.id === item.id ? "true" : undefined}
                    disabled={savingKey !== null}
                    onClick={() => void handleSelectItem(item.id)}
                    type="button"
                  >
                    <strong>{item.japanese}</strong>
                    <span>{item.title}</span>
                    <small>{formatStatus(item.status)}</small>
                    <small>
                      {formatBand(item.band)} {item.jlptLevel ?? "no JLPT"}
                    </small>
                    <small>{item.qualityIssues.length} quality issue(s)</small>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div
            aria-label="Навигация по очереди проверки"
            className="admin-queue-pagination"
            data-testid="admin-review-queue-pagination"
          >
            <span>
              Страница {queueCursorHistory.length + 1} · Материалов: {state.queue.length}
            </span>
            <div className="action-row">
              <button
                className="secondary-action"
                disabled={queueCursorHistory.length === 0 || savingKey !== null}
                onClick={() => void handleQueuePage(queueCursorHistory.at(-1) ?? null, "previous")}
                type="button"
              >
                Назад
              </button>
              <button
                className="secondary-action"
                disabled={state.queuePagination.nextCursor === null || savingKey !== null}
                onClick={() => {
                  const nextCursor = state.queuePagination.nextCursor;

                  if (nextCursor !== null) {
                    void handleQueuePage(nextCursor, "next");
                  }
                }}
                type="button"
              >
                Далее
              </button>
            </div>
          </div>

          <div className="admin-import-runs">
            <h2>Import runs</h2>
            {state.importRuns.length === 0 ? (
              <p className="muted">Запусков импорта пока нет.</p>
            ) : (
              <ul className="source-list" data-testid="admin-import-runs">
                {state.importRuns.map((run) => (
                  <li key={run.id}>
                    <strong>{run.dataSourceName}</strong>
                    <span>
                      {formatImportStatus(run.status)} · {run.recordCount} записей
                    </span>
                    <small>{formatImportRunSourceMeta(run)}</small>
                    <p>{run.sourceFileName}</p>
                    <small>{formatImportRunTiming(run)}</small>
                    <small>{run.checksumSha256}</small>
                    <small>{formatImportRunStats(run)}</small>
                    <small>
                      {run.errorText === null ? "Ошибок нет" : `Ошибка: ${run.errorText}`}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="admin-candidate-ranking" data-testid="admin-imported-candidates">
            <h2>Импортированные кандидаты</h2>
            {state.importedCandidates.length === 0 ? (
              <p className="muted">Новых импортированных целей пока нет.</p>
            ) : (
              <ol>
                {state.importedCandidates.map((candidate) => (
                  <li key={`${candidate.itemType}:${candidate.targetId}`}>
                    <button
                      aria-pressed={promoteDraft.targetId === candidate.targetId}
                      disabled={savingKey !== null}
                      onClick={() => handleSelectImportedCandidate(candidate)}
                      type="button"
                    >
                      <span className="admin-candidate-heading">
                        <strong>{candidate.japanese}</strong>
                        <b>
                          #{candidate.rank} · {candidate.score}
                        </b>
                      </span>
                      <span>{formatCandidateSummary(candidate)}</span>
                      <small>
                        {candidate.sourceName} · {formatCandidatePriority(candidate)} ·{" "}
                        {formatBand(candidate.suggestedBand)}
                        {candidate.jlptLevel === null ? "" : ` · ${candidate.jlptLevel}`}
                      </small>
                      <small>{formatCandidateReasons(candidate.reasons)}</small>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <form
            className="admin-promote-form"
            onSubmit={(event) => void handlePromoteCandidate(event)}
          >
            <h2>Promote candidate</h2>
            <label>
              Target type
              <select
                onChange={(event) => {
                  const targetType = event.currentTarget.value as PromoteDraft["targetType"];
                  setPromoteDraft((previous) => ({ ...previous, targetType }));
                }}
                value={promoteDraft.targetType}
              >
                <option value="component">Component</option>
                <option value="kanji">Kanji</option>
                <option value="word">Word</option>
                <option value="sentence">Sentence</option>
              </select>
            </label>
            <label>
              Target ID
              <input
                onChange={(event) => {
                  const targetId = event.currentTarget.value;
                  setPromoteDraft((previous) => ({ ...previous, targetId }));
                }}
                value={promoteDraft.targetId}
              />
            </label>
            <label>
              Curated title
              <input
                onChange={(event) => {
                  const title = event.currentTarget.value;
                  setPromoteDraft((previous) => ({ ...previous, title }));
                }}
                value={promoteDraft.title}
              />
            </label>
            <div className="admin-two-column">
              <label>
                Band
                <select
                  onChange={(event) => {
                    const band = event.currentTarget.value as CourseBand;
                    setPromoteDraft((previous) => ({ ...previous, band }));
                  }}
                  value={promoteDraft.band}
                >
                  {SUPPORTED_COURSE_BANDS.map((band) => (
                    <option key={band} value={band}>
                      {formatBand(band)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Level
                <input
                  inputMode="numeric"
                  onChange={(event) => {
                    const level = event.currentTarget.value;
                    setPromoteDraft((previous) => ({ ...previous, level }));
                  }}
                  value={promoteDraft.level}
                />
              </label>
            </div>
            <button className="secondary-action" disabled={savingKey !== null} type="submit">
              Promote
            </button>
          </form>
        </aside>

        {activeItem === null ? (
          <div className="panel">
            <h2>Материал</h2>
            <p className="muted">Выберите item из очереди, когда он появится.</p>
          </div>
        ) : (
          <div className="admin-editor">
            <section className="panel admin-item-header">
              <div>
                <span className="eyebrow">{formatItemType(activeItem.itemType)}</span>
                <h2>{activeItem.japanese}</h2>
                <p>
                  {activeItem.title} · {formatStatus(activeItem.status)}
                </p>
              </div>
              <dl className="stats-list">
                <div>
                  <dt>Чтение</dt>
                  <dd>{activeItem.reading ?? "нет"}</dd>
                </div>
                <div>
                  <dt>Уровень</dt>
                  <dd>{activeItem.level ?? "нет"}</dd>
                </div>
                <div>
                  <dt>Band</dt>
                  <dd>{formatBand(activeItem.band)}</dd>
                </div>
                <div>
                  <dt>JLPT</dt>
                  <dd>{activeItem.jlptLevel ?? "нет"}</dd>
                </div>
                <div>
                  <dt>Обновлено</dt>
                  <dd>{formatDate(activeItem.updatedAt)}</dd>
                </div>
              </dl>
            </section>

            <form className="panel admin-form" onSubmit={(event) => void handleSaveItem(event)}>
              <h2>Значения и подсказки</h2>
              <div className="admin-two-column">
                <label>
                  Статус
                  <select
                    onChange={(event) => {
                      const status = event.currentTarget.value as AdminContentStatus;
                      setItemDraft((previous) => ({ ...previous, status }));
                    }}
                    value={itemDraft.status}
                  >
                    <option value="draft">Черновик</option>
                    <option value="needs-review">Нужна проверка</option>
                    <option value="published">Опубликовано</option>
                    <option value="archived">Архив</option>
                  </select>
                </label>
                <label>
                  Band
                  <select
                    onChange={(event) => {
                      const band = event.currentTarget.value as ItemDraft["band"];
                      setItemDraft((previous) => ({ ...previous, band }));
                    }}
                    value={itemDraft.band}
                  >
                    <option value="">Unset</option>
                    {SUPPORTED_COURSE_BANDS.map((band) => (
                      <option key={band} value={band}>
                        {formatBand(band)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="admin-two-column">
                <label>
                  Значение RU
                  <input
                    data-testid="admin-meaning-ru"
                    onChange={(event) => {
                      const meaningRu = event.currentTarget.value;
                      setItemDraft((previous) => ({ ...previous, meaningRu }));
                    }}
                    value={itemDraft.meaningRu}
                  />
                </label>
                <label>
                  Meaning EN
                  <input
                    data-testid="admin-meaning-en"
                    onChange={(event) => {
                      const meaningEn = event.currentTarget.value;
                      setItemDraft((previous) => ({ ...previous, meaningEn }));
                    }}
                    value={itemDraft.meaningEn}
                  />
                </label>
              </div>
              <div className="admin-two-column">
                <label>
                  Подсказка RU
                  <textarea
                    onChange={(event) => {
                      const hintRu = event.currentTarget.value;
                      setItemDraft((previous) => ({ ...previous, hintRu }));
                    }}
                    value={itemDraft.hintRu}
                  />
                </label>
                <label>
                  Hint EN
                  <textarea
                    onChange={(event) => {
                      const hintEn = event.currentTarget.value;
                      setItemDraft((previous) => ({ ...previous, hintEn }));
                    }}
                    value={itemDraft.hintEn}
                  />
                </label>
              </div>
              <div className="admin-two-column">
                <label>
                  Мнемоника RU
                  <textarea
                    onChange={(event) => {
                      const mnemonicRu = event.currentTarget.value;
                      setItemDraft((previous) => ({ ...previous, mnemonicRu }));
                    }}
                    value={itemDraft.mnemonicRu}
                  />
                </label>
                <label>
                  Mnemonic EN
                  <textarea
                    onChange={(event) => {
                      const mnemonicEn = event.currentTarget.value;
                      setItemDraft((previous) => ({ ...previous, mnemonicEn }));
                    }}
                    value={itemDraft.mnemonicEn}
                  />
                </label>
              </div>
              <button className="primary-action" disabled={savingKey !== null} type="submit">
                Сохранить материал
              </button>
            </form>

            <section className="panel admin-card-list">
              <h2>Ответы карточек</h2>
              {activeItem.cards.map((card) => (
                <article key={card.id}>
                  <div>
                    <h3>
                      {formatPromptType(card.promptType)} · {formatAnswerType(card.answerType)}
                    </h3>
                    <small>Обновлено: {formatDate(card.updatedAt)}</small>
                  </div>
                  <div className="admin-two-column">
                    <label>
                      Accepted RU
                      <textarea
                        data-testid="admin-accepted-ru"
                        onChange={(event) => updateCardDraft(card.id, "acceptedRu", event)}
                        value={cardDrafts[card.id]?.acceptedRu ?? ""}
                      />
                    </label>
                    <label>
                      Accepted EN
                      <textarea
                        data-testid="admin-accepted-en"
                        onChange={(event) => updateCardDraft(card.id, "acceptedEn", event)}
                        value={cardDrafts[card.id]?.acceptedEn ?? ""}
                      />
                    </label>
                  </div>
                  <label>
                    Заблокированные ответы
                    <textarea
                      onChange={(event) => updateCardDraft(card.id, "blocked", event)}
                      value={cardDrafts[card.id]?.blocked ?? ""}
                    />
                  </label>
                  <label>
                    Причина блокировки
                    <input
                      onChange={(event) => updateCardDraft(card.id, "blockedReason", event)}
                      value={cardDrafts[card.id]?.blockedReason ?? ""}
                    />
                  </label>
                  <button
                    className="secondary-action"
                    data-testid="admin-save-card"
                    disabled={savingKey !== null}
                    onClick={() => void handleSaveCard(card)}
                    type="button"
                  >
                    Сохранить ответы
                  </button>
                </article>
              ))}
            </section>

            <div className="admin-side-grid">
              <section className="panel">
                <h2>Quality gates</h2>
                {activeItem.qualityIssues.length === 0 ? (
                  <p className="success-text">Ready to publish.</p>
                ) : (
                  <ul className="quality-list">
                    {activeItem.qualityIssues.map((issue, index) => (
                      <li key={`${issue.code}-${issue.cardId ?? issue.dependencyItemId ?? index}`}>
                        <strong>{formatQualityIssueCode(issue.code)}</strong>
                        <span>{issue.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <PrerequisiteEditor
                disabled={savingKey !== null}
                item={activeItem}
                onSave={handleSavePrerequisites}
                token={state.token}
              />

              <CoursePlacementEditor
                disabled={savingKey !== null}
                item={activeItem}
                onSave={handleSaveCoursePlacements}
                token={state.token}
              />

              <section className="panel">
                <h2>Источники</h2>
                {activeItem.attributions.length === 0 ? (
                  <p className="muted">Источник не указан.</p>
                ) : (
                  <ul className="source-list">
                    {activeItem.attributions.map((source) => (
                      <li key={`${source.sourceName}-${source.licenseName}`}>
                        <strong>{source.sourceName}</strong>
                        <span>{source.licenseName}</span>
                        <p>{source.attributionText}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {sourceNames === "" ? null : <p className="muted">Сводка: {sourceNames}</p>}
              </section>

              <section className="panel">
                <h2>Import runs</h2>
                {activeItem.importRuns.length === 0 ? (
                  <p className="muted">Импорт не связан с материалом.</p>
                ) : (
                  <ul className="source-list">
                    {activeItem.importRuns.map((run) => (
                      <li key={run.id}>
                        <strong>{run.dataSourceName}</strong>
                        <span>
                          {formatImportStatus(run.status)} · {run.recordCount} записей
                        </span>
                        <p>{run.sourceFileName}</p>
                        <small>{formatImportRunSourceMeta(run)}</small>
                        <small>{formatImportRunTiming(run)}</small>
                        <small>{run.checksumSha256}</small>
                        <small>{formatImportRunStats(run)}</small>
                        <small>
                          {run.errorText === null ? "Ошибок нет" : `Ошибка: ${run.errorText}`}
                        </small>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </section>
  );

  function updateCardDraft(
    cardId: string,
    field: keyof CardDraft,
    event: { readonly currentTarget: HTMLInputElement | HTMLTextAreaElement },
  ): void {
    const value = event.currentTarget.value;

    setCardDrafts((previous) => ({
      ...previous,
      [cardId]: {
        ...(previous[cardId] ?? EMPTY_CARD_DRAFT),
        [field]: value,
      },
    }));
  }
}

const ADMIN_REVIEW_QUEUE_PAGE_LIMIT = 20;

const DEFAULT_FILTERS: AdminFilters = {
  band: "",
  jlptLevel: "",
  status: "needs-review",
  missingAcceptedAnswers: false,
  missingMnemonics: false,
};

const EMPTY_ITEM_DRAFT: ItemDraft = {
  status: "needs-review",
  band: "",
  meaningRu: "",
  meaningEn: "",
  hintRu: "",
  hintEn: "",
  mnemonicRu: "",
  mnemonicEn: "",
};

const EMPTY_CARD_DRAFT: CardDraft = {
  acceptedRu: "",
  acceptedEn: "",
  blocked: "",
  blockedReason: "",
};

const EMPTY_PROMOTE_DRAFT: PromoteDraft = {
  targetType: "word",
  targetId: "",
  title: "",
  band: "n5",
  level: "",
};

const EMPTY_TRANSLATION_REVIEW_DRAFT: TranslationReviewDraft = {
  targetType: "word",
  targetId: "",
  title: "",
  band: "n5",
  level: "",
  meaningRu: "",
  meaningEn: "",
  acceptedRu: "",
  acceptedEn: "",
  acceptedReadings: "",
};

function isBilingualCandidate(candidate: AdminImportedCandidateDto): boolean {
  return candidate.meanings.ru.length > 0 && candidate.meanings.en.length > 0;
}

function buildTranslationReviewDraftFromCandidate(
  candidate: AdminImportedCandidateDto,
): TranslationReviewDraft {
  return {
    targetType: candidate.itemType,
    targetId: candidate.targetId,
    title: candidate.suggestedTitle,
    band: candidate.suggestedBand,
    level: "",
    meaningRu: candidate.meanings.ru[0] ?? "",
    meaningEn: candidate.meanings.en[0] ?? "",
    acceptedRu: candidate.meanings.ru.join("\n"),
    acceptedEn: candidate.meanings.en.join("\n"),
    acceptedReadings: candidate.reading ?? "",
  };
}

function buildTranslationReviewDraftFromDetails(
  details: AdminImportedCandidateDetailsDto,
  suggestedBand: CourseBand,
): TranslationReviewDraft {
  return {
    targetType: details.itemType,
    targetId: details.targetId,
    title: `${details.itemType === "kanji" ? "Кандзи" : "Слово"} ${details.japanese}`,
    band: suggestedBand,
    level: "",
    meaningRu: details.meanings.ru[0] ?? "",
    meaningEn: details.meanings.en[0] ?? "",
    acceptedRu: details.meanings.ru.join("\n"),
    acceptedEn: details.meanings.en.join("\n"),
    acceptedReadings: details.reading ?? details.readings[0]?.text ?? "",
  };
}

function formatImportedReadings(details: AdminImportedCandidateDetailsDto): string {
  if (details.readings.length === 0) {
    return "нет";
  }

  return details.readings
    .map((reading) => `${formatImportedReadingType(reading.type)}: ${reading.text}`)
    .join(" · ");
}

function formatImportedReadingType(
  type: AdminImportedCandidateDetailsDto["readings"][number]["type"],
): string {
  switch (type) {
    case "on":
      return "он";
    case "kun":
      return "кун";
    case "nanori":
      return "нанори";
    case "word":
      return "слово";
    default:
      return "другое";
  }
}

function buildItemDraft(item: AdminCurationItemDto): ItemDraft {
  return {
    status: item.status,
    band: item.band ?? "",
    meaningRu: item.meanings.ru,
    meaningEn: item.meanings.en,
    hintRu: findText(item.hints, "ru-RU"),
    hintEn: findText(item.hints, "en-US"),
    mnemonicRu: findText(item.mnemonics, "ru-RU"),
    mnemonicEn: findText(item.mnemonics, "en-US"),
  };
}

function buildCardDrafts(cards: readonly AdminCurationCardDto[]): Record<string, CardDraft> {
  return Object.fromEntries(
    cards.map((card) => [
      card.id,
      {
        acceptedRu: card.acceptedAnswers
          .filter((answer) => answer.locale === "ru-RU")
          .map((answer) => answer.text)
          .join("\n"),
        acceptedEn: card.acceptedAnswers
          .filter((answer) => answer.locale === "en-US")
          .map((answer) => answer.text)
          .join("\n"),
        blocked: card.blockedAnswers.map((answer) => answer.text).join("\n"),
        blockedReason: card.blockedAnswers[0]?.reason ?? "",
      },
    ]),
  );
}

function findText(
  texts: readonly { readonly locale: string; readonly body: string }[],
  locale: "ru-RU" | "en-US",
): string {
  return texts.find((text) => text.locale === locale)?.body ?? "";
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

function toApiFilters(filters: AdminFilters): AdminReviewQueueFilters {
  return {
    ...(filters.band === "" ? {} : { band: filters.band }),
    ...(filters.jlptLevel === "" ? {} : { jlptLevel: filters.jlptLevel }),
    status: filters.status,
    ...(filters.missingAcceptedAnswers
      ? { missingAcceptedAnswers: filters.missingAcceptedAnswers }
      : {}),
    ...(filters.missingMnemonics ? { missingMnemonics: filters.missingMnemonics } : {}),
  };
}

function formatBand(value: CourseBand | null): string {
  switch (value) {
    case "foundation":
      return "Foundation";
    case "n5":
      return "N5";
    case "n4":
      return "N4";
    case "n3":
      return "N3";
    case "n2":
      return "N2";
    default:
      return "Unset";
  }
}

function formatCandidateSummary(candidate: AdminImportedCandidateDto): string {
  return [
    candidate.reading,
    candidate.meanings.ru.length === 0 ? null : `RU: ${candidate.meanings.ru.join(", ")}`,
    candidate.meanings.en.length === 0 ? null : `EN: ${candidate.meanings.en.join(", ")}`,
  ]
    .filter((value) => value !== null && value !== "")
    .join(" · ");
}

function formatCandidatePriority(candidate: AdminImportedCandidateDto): string {
  if (candidate.sourcePriority === null) {
    return "без частотного ранга";
  }

  return candidate.itemType === "kanji"
    ? `частота #${candidate.sourcePriority}`
    : `примерный ранг #${candidate.sourcePriority}`;
}

function formatCandidateReasons(reasons: AdminImportedCandidateDto["reasons"]): string {
  return reasons
    .map((reason) => `${formatCandidateReason(reason.code)} +${reason.points}`)
    .join(" · ");
}

function formatCandidateReason(code: AdminImportedCandidateDto["reasons"][number]["code"]): string {
  switch (code) {
    case "source-frequency":
      return "частотность";
    case "source-priority":
      return "приоритет JMdict";
    case "jlpt":
      return "JLPT";
    case "school-grade":
      return "школьный класс";
    case "ru-coverage":
      return "есть RU";
    case "en-coverage":
      return "есть EN";
    case "reading":
      return "есть чтение";
    case "stroke-data":
      return "есть KanjiVG";
    case "kanji-orthography":
      return "запись с кандзи";
  }
}

function formatQualityIssueCode(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatItemType(value: string): string {
  switch (value) {
    case "component":
      return "Компонент";
    case "kanji":
      return "Кандзи";
    case "word":
      return "Слово";
    case "sentence":
      return "Предложение";
    default:
      return value;
  }
}

function formatStatus(value: AdminContentStatus): string {
  switch (value) {
    case "draft":
      return "черновик";
    case "needs-review":
      return "нужна проверка";
    case "published":
      return "опубликовано";
    case "archived":
      return "архив";
  }
}

function formatImportStatus(value: string): string {
  switch (value) {
    case "pending":
      return "ожидает";
    case "success":
      return "успешно";
    case "failed":
      return "ошибка";
    default:
      return value;
  }
}

function formatImportRunStats(run: AdminImportRunSummaryDto): string {
  const entries = Object.entries(run.stats);

  if (entries.length === 0) {
    return "stats: none";
  }

  return entries.map(([key, value]) => `${key}: ${value ?? "null"}`).join(" · ");
}

function formatImportRunSourceMeta(run: AdminImportRunSummaryDto): string {
  return run.sourceVersion === null ? run.licenseName : `${run.licenseName} · ${run.sourceVersion}`;
}

function formatImportRunTiming(run: AdminImportRunSummaryDto): string {
  return run.finishedAt === null
    ? `started: ${formatDate(run.startedAt)}`
    : `${formatDate(run.startedAt)} -> ${formatDate(run.finishedAt)}`;
}

function formatPromptType(value: string): string {
  switch (value) {
    case "meaning":
      return "значение";
    case "reading":
      return "чтение";
    case "recall":
      return "вспоминание";
    case "cloze":
      return "пропуск";
    case "recognition":
      return "узнавание";
    default:
      return value;
  }
}

function formatAnswerType(value: string): string {
  return value === "reading" ? "чтение" : "значение";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
