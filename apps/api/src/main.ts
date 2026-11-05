import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import express from "express";
import { AppModule } from "./app.module";
import { CORS_ORIGIN, PORT } from "./config";

const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
// Herpstat uploads: keep the raw body as text whatever the content type, so we can store + parse it.
app.use("/ingest", express.text({ type: () => true, limit: "256kb" }));
app.use(express.json({ limit: "1mb" }));
app.enableCors({ origin: CORS_ORIGIN.split(",") });
app.enableShutdownHooks();
await app.listen(PORT);
console.log(`API listening on :${PORT}`);
