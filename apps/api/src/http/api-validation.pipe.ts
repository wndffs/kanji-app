import {
  BadRequestException,
  Injectable,
  type ArgumentMetadata,
  type PipeTransform,
} from "@nestjs/common";

@Injectable()
export class ApiValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== "body" || value === undefined) {
      return value;
    }

    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException("Тело запроса должно быть JSON-объектом.");
    }

    return value;
  }
}
