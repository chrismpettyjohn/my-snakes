import {Logger} from '@nestjs/common';
import type {NextFunction, Request, Response} from 'express';

const logger = new Logger('HTTP');

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = performance.now();
  res.on('finish', () => {
    const ms = (performance.now() - start).toFixed(1);
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms - ${req.ip}`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.log(line);
  });
  next();
}
