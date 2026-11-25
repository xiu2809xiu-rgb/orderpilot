import { SetMetadata } from "@nestjs/common";

export const SPARK_QUESTION_RATE_LIMIT_KEY = "op:spark-question-rate-limit";

/**
 * Counts the route against the throttler that app.module names "spark", whose
 * limit is SPARK_QUESTIONS_PER_MINUTE. The question route is the only one that
 * pays a model by the token, so it is the only one marked.
 */
export const SparkQuestionRateLimit = (): MethodDecorator =>
  SetMetadata(SPARK_QUESTION_RATE_LIMIT_KEY, true);
