import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from "@nestjs/common";
import { AppConfig } from "../config/app-config.js";
import {
  ObjectStorage,
  assertValidKey,
  type ObjectInfo,
  type PutOptions,
  type StoredObject,
} from "./object-storage.js";

/** S3 says "not found" in two ways, depending on the call and the server. */
function isMissing(error: unknown): boolean {
  return (
    error instanceof S3ServiceException &&
    (error.name === "NotFound" ||
      error.name === "NoSuchKey" ||
      error.$metadata.httpStatusCode === 404)
  );
}

/**
 * ObjectStorage over the S3 API. Works with MinIO (an endpoint and path-style
 * addressing) and with AWS S3 (neither). Nothing else in the API imports the
 * AWS SDK.
 */
@Injectable()
export class S3ObjectStorage
  extends ObjectStorage
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(S3ObjectStorage.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(@Inject(AppConfig) private readonly config: AppConfig) {
    super();
    const { storage } = config;
    this.bucket = storage.bucket;
    this.client = new S3Client({
      region: storage.region,
      ...(storage.endpoint === null ? {} : { endpoint: storage.endpoint }),
      forcePathStyle: storage.forcePathStyle,
      credentials: {
        accessKeyId: storage.accessKeyId,
        secretAccessKey: storage.secretAccessKey,
      },
      // A dead store must fail a request in seconds, not hang it.
      requestHandler: { connectionTimeout: 3_000, requestTimeout: 30_000 },
      maxAttempts: 2,
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.config.storage.createBucket) return;
    try {
      await this.ensureBucket();
    } catch (error) {
      // The API still starts; /health/ready says storage is down.
      this.logger.warn({ err: error }, "Could not create the storage bucket");
    }
  }

  onApplicationShutdown(): void {
    this.client.destroy();
  }

  /** Creates the bucket if it is missing. Safe to call again. */
  async ensureBucket(): Promise<void> {
    try {
      await this.ping();
    } catch (error) {
      if (!isMissing(error)) throw error;
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  async put(
    key: string,
    body: Uint8Array | string,
    options: PutOptions = {},
  ): Promise<ObjectInfo> {
    assertValidKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: options.contentType ?? "application/octet-stream",
      }),
    );
    const info = await this.head(key);
    if (info === null) throw new Error(`Stored object ${key} is missing`);
    return info;
  }

  async get(key: string): Promise<StoredObject | null> {
    assertValidKey(key);
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const bytes = await result.Body?.transformToByteArray();
      const body = Buffer.from(bytes ?? new Uint8Array());
      return {
        info: {
          key,
          size: body.length,
          contentType: result.ContentType ?? null,
          etag: result.ETag ?? null,
          lastModified: result.LastModified ?? null,
        },
        body,
      };
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async head(key: string): Promise<ObjectInfo | null> {
    assertValidKey(key);
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        key,
        size: result.ContentLength ?? 0,
        contentType: result.ContentType ?? null,
        etag: result.ETag ?? null,
        lastModified: result.LastModified ?? null,
      };
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    assertValidKey(key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
