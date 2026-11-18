import 'reflect-metadata';
import express from 'express';
import {AppModule} from './app.module';
import {NestFactory} from '@nestjs/core';
import {HOST, PORT, WEB_URL} from './config';
import {requestLogger} from './common/request-logger';
import type {NestExpressApplication} from '@nestjs/platform-express';

const app = await NestFactory.create<NestExpressApplication>(AppModule, {bodyParser: false});
app.use(requestLogger);
app.use('/webhook', express.text({type: () => true, limit: '256kb'}));
app.use(express.json({limit: '1mb'}));
app.enableCors({origin: WEB_URL});
app.enableShutdownHooks();
await app.listen(PORT, HOST);
console.log(`API listening on ${HOST}:${PORT}`);
