import { Global, Module, type DynamicModule } from "@nestjs/common";
import { AppConfig } from "./app-config.js";

/** Makes the one AppConfig injectable everywhere. Tests pass their own. */
@Global()
@Module({})
export class ConfigModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: AppConfig, useValue: config }],
      exports: [AppConfig],
    };
  }
}
