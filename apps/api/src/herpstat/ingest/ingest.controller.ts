import type {Request} from 'express';
import {Public} from '../../auth/auth.guard';
import {bearerToken} from '../../auth/bearer';
import {IngestService} from './ingest.service';
import {Controller, HttpCode, Param, Post, Req, UnauthorizedException} from '@nestjs/common';

@Controller('ingest/herpstat')
@Public()
export class IngestController {
  constructor(private ingest: IngestService) {}

  @Post()
  @HttpCode(200)
  receive(@Req() req: Request) {
    return this.handle(req, undefined);
  }

  @Post(':token')
  @HttpCode(200)
  receiveWithToken(@Req() req: Request, @Param('token') token: string) {
    return this.handle(req, token);
  }

  private handle(req: Request, pathToken?: string) {
    const body = typeof req.body === 'string' ? req.body : '';
    const token = pathToken ?? findToken(req, body);
    if (!token) throw new UnauthorizedException('Missing API key');
    return this.ingest.receive({token, body, contentType: req.headers['content-type'], headers: req.headers});
  }
}

function findToken(req: Request, body: string): string | undefined {
  const h = req.headers;
  const q = req.query as Record<string, string | undefined>;
  const fromHeader = (h['x-api-key'] ?? h['apikey'] ?? h['api-key']) as string | undefined;
  let fromBody: string | undefined;
  try {
    const b = body.trim().startsWith('{') ? JSON.parse(body) : Object.fromEntries(new URLSearchParams(body));
    fromBody = b.apikey ?? b.api_key ?? b.apiKey ?? b.APIKEY ?? b.key;
  } catch {}
  return q.key ?? q.apikey ?? q.api_key ?? fromHeader ?? bearerToken(h.authorization) ?? fromBody;
}
