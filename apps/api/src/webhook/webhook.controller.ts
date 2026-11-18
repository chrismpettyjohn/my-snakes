import type {Request} from 'express';
import {Public} from '../auth/auth.guard';
import {bearerToken} from '../auth/bearer';
import {WebhookService} from './webhook.service';
import {Controller, HttpCode, Param, Post, Req, UnauthorizedException} from '@nestjs/common';

@Controller()
export class WebhookController {
  constructor(private webhook: WebhookService) {}

  @Post('webhook/:webhookId')
  @Public()
  @HttpCode(200)
  receive(@Req() req: Request, @Param('webhookId') webhookId: string) {
    const body = typeof req.body === 'string' ? req.body : '';
    const apiKey = findApiKey(req, body);
    if (!apiKey) throw new UnauthorizedException('Missing API key');
    return this.webhook.receive({webhookId, apiKey, body, contentType: req.headers['content-type'], headers: req.headers});
  }
}

function findApiKey(req: Request, body: string): string | undefined {
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
