import 'reflect-metadata';
import express from 'express';
import {AppModule} from './app.module';
import {NestFactory} from '@nestjs/core';
import {CORS_ORIGIN, PORT} from './config';
import type {NestExpressApplication} from '@nestjs/platform-express';

const app = await NestFactory.create<NestExpressApplication>(AppModule, {bodyParser: false});
app.use('/ingest', express.text({type: () => true, limit: '256kb'}));
app.use(express.json({limit: '1mb'}));
app.enableCors({origin: CORS_ORIGIN.split(',')});
app.enableShutdownHooks();
await app.listen(PORT);
console.log(`API listening on :${PORT}`);
