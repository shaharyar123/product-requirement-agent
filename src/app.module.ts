import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SpecModule } from "./spec/spec.module";

/**
 * Root application module.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    SpecModule,
  ],
})
export class AppModule {}
