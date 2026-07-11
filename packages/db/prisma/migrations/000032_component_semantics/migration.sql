-- Separate component names and visual descriptions from learning meanings.

ALTER TABLE "Component"
ADD COLUMN "displayNameEn" TEXT NOT NULL DEFAULT '',
ADD COLUMN "shapeDescriptionRu" TEXT,
ADD COLUMN "shapeDescriptionEn" TEXT;

CREATE INDEX "Component_displayNameEn_idx"
ON "Component"("displayNameEn");

UPDATE "Component"
SET
  "displayNameRu" = 'единица',
  "displayNameEn" = 'one',
  "shapeDescriptionRu" = 'горизонтальная черта',
  "shapeDescriptionEn" = 'horizontal stroke',
  "meaningRu" = 'один',
  "meaningEn" = 'one'
WHERE "symbol" = '一';

UPDATE "Component"
SET
  "displayNameRu" = 'рот',
  "displayNameEn" = 'mouth',
  "shapeDescriptionRu" = 'прямоугольная рамка',
  "shapeDescriptionEn" = 'rectangular frame',
  "meaningRu" = 'рот',
  "meaningEn" = 'mouth'
WHERE "symbol" = '口';

-- Remove possible desired-answer duplicates before rewriting the old bootstrap answers.
DELETE FROM "LearningAnswer" AS answer
USING "LearningCard" AS card, "LearningItem" AS item, "Component" AS component
WHERE answer."learningCardId" = card."id"
  AND card."learningItemId" = item."id"
  AND item."targetType" = 'COMPONENT'
  AND item."targetId" = component."id"
  AND answer."sourceKind" = 'PROJECT_AUTHORED'
  AND (
    (component."symbol" = '一' AND answer."normalizedText" IN ('единица', 'один', 'one'))
    OR (component."symbol" = '口' AND answer."normalizedText" IN ('рот', 'mouth'))
  );

UPDATE "LearningAnswer" AS answer
SET "text" = 'единица', "normalizedText" = 'единица', "isPrimary" = TRUE
FROM "LearningCard" AS card, "LearningItem" AS item, "Component" AS component
WHERE answer."learningCardId" = card."id"
  AND card."learningItemId" = item."id"
  AND item."targetType" = 'COMPONENT'
  AND item."targetId" = component."id"
  AND component."symbol" = '一'
  AND answer."sourceKind" = 'PROJECT_AUTHORED'
  AND answer."normalizedText" = 'одна черта';

UPDATE "LearningAnswer" AS answer
SET "text" = 'один', "normalizedText" = 'один', "isPrimary" = FALSE
FROM "LearningCard" AS card, "LearningItem" AS item, "Component" AS component
WHERE answer."learningCardId" = card."id"
  AND card."learningItemId" = item."id"
  AND item."targetType" = 'COMPONENT'
  AND item."targetId" = component."id"
  AND component."symbol" = '一'
  AND answer."sourceKind" = 'PROJECT_AUTHORED'
  AND answer."normalizedText" = 'черта один';

UPDATE "LearningAnswer" AS answer
SET "text" = 'one', "normalizedText" = 'one', "isPrimary" = TRUE
FROM "LearningCard" AS card, "LearningItem" AS item, "Component" AS component
WHERE answer."learningCardId" = card."id"
  AND card."learningItemId" = item."id"
  AND item."targetType" = 'COMPONENT'
  AND item."targetId" = component."id"
  AND component."symbol" = '一'
  AND answer."sourceKind" = 'PROJECT_AUTHORED'
  AND answer."normalizedText" = 'one stroke';

UPDATE "LearningAnswer" AS answer
SET "text" = 'рот', "normalizedText" = 'рот', "isPrimary" = TRUE
FROM "LearningCard" AS card, "LearningItem" AS item, "Component" AS component
WHERE answer."learningCardId" = card."id"
  AND card."learningItemId" = item."id"
  AND item."targetType" = 'COMPONENT'
  AND item."targetId" = component."id"
  AND component."symbol" = '口'
  AND answer."sourceKind" = 'PROJECT_AUTHORED'
  AND answer."normalizedText" = 'отверстие';

UPDATE "LearningAnswer" AS answer
SET "text" = 'mouth', "normalizedText" = 'mouth', "isPrimary" = TRUE
FROM "LearningCard" AS card, "LearningItem" AS item, "Component" AS component
WHERE answer."learningCardId" = card."id"
  AND card."learningItemId" = item."id"
  AND item."targetType" = 'COMPONENT'
  AND item."targetId" = component."id"
  AND component."symbol" = '口'
  AND answer."sourceKind" = 'PROJECT_AUTHORED'
  AND answer."normalizedText" = 'opening';

DELETE FROM "LearningAnswer" AS answer
USING "LearningCard" AS card, "LearningItem" AS item, "Component" AS component
WHERE answer."learningCardId" = card."id"
  AND card."learningItemId" = item."id"
  AND item."targetType" = 'COMPONENT'
  AND item."targetId" = component."id"
  AND component."symbol" = '口'
  AND answer."sourceKind" = 'PROJECT_AUTHORED'
  AND answer."normalizedText" = 'рамка рта';

DELETE FROM "BlockedAnswer" AS answer
USING "LearningCard" AS card, "LearningItem" AS item, "Component" AS component
WHERE answer."learningCardId" = card."id"
  AND card."learningItemId" = item."id"
  AND item."targetType" = 'COMPONENT'
  AND item."targetId" = component."id"
  AND answer."sourceKind" = 'PROJECT_AUTHORED'
  AND (
    (component."symbol" = '一' AND answer."normalizedText" = 'одна черта')
    OR (component."symbol" = '口' AND answer."normalizedText" = 'отверстие')
  );

UPDATE "BlockedAnswer" AS answer
SET "text" = 'одна черта', "normalizedText" = 'одна черта',
    "reason" = 'Это описание формы, а не значение компонента.'
FROM "LearningCard" AS card, "LearningItem" AS item, "Component" AS component
WHERE answer."learningCardId" = card."id"
  AND card."learningItemId" = item."id"
  AND item."targetType" = 'COMPONENT'
  AND item."targetId" = component."id"
  AND component."symbol" = '一'
  AND answer."sourceKind" = 'PROJECT_AUTHORED'
  AND answer."normalizedText" = 'линия';

UPDATE "BlockedAnswer" AS answer
SET "text" = 'отверстие', "normalizedText" = 'отверстие',
    "reason" = 'Это не значение компонента 口; правильное базовое значение - рот.'
FROM "LearningCard" AS card, "LearningItem" AS item, "Component" AS component
WHERE answer."learningCardId" = card."id"
  AND card."learningItemId" = item."id"
  AND item."targetType" = 'COMPONENT'
  AND item."targetId" = component."id"
  AND component."symbol" = '口'
  AND answer."sourceKind" = 'PROJECT_AUTHORED'
  AND answer."normalizedText" = 'квадрат';
