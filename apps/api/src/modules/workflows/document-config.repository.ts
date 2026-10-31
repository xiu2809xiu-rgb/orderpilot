import { Inject, Injectable } from "@nestjs/common";
import {
  DEFAULT_DOCUMENT_CONFIG,
  configurableDocumentTypeSchema,
  documentFieldSchema,
  type DocumentTypeConfig,
} from "@orderpilot/shared";
import { z } from "zod";
import { Database } from "../../database/database.js";

const fieldsSchema = z.array(documentFieldSchema);

/**
 * The field settings and defaults of each document type, read from the
 * DocumentTypeConfig table. Changing a default is an edit to a row. The table
 * is seeded from DEFAULT_DOCUMENT_CONFIG; the labels stay in code because they
 * are names, not settings.
 */
@Injectable()
export class DocumentConfigRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  async list(): Promise<DocumentTypeConfig[]> {
    const rows = await this.database.client.documentTypeConfig.findMany({
      orderBy: { documentType: "asc" },
    });
    return rows.flatMap((row) => {
      const type = configurableDocumentTypeSchema.safeParse(row.documentType);
      const fields = fieldsSchema.safeParse(row.fields);
      if (!type.success || !fields.success) return [];
      const label =
        DEFAULT_DOCUMENT_CONFIG.find(
          (entry) => entry.documentType === type.data,
        )?.label ?? type.data;
      return [{ documentType: type.data, label, fields: fields.data }];
    });
  }
}
