import type {Request} from 'express';
import {bearerToken} from '../auth/bearer';
import {WebhookService} from './webhook.service';
import {Public, UserId} from '../auth/auth.guard';
import {AccessService} from '../common/access.service';
import {Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UnauthorizedException} from '@nestjs/common';

@Controller()
export class WebhookController {
  constructor(
    private access: AccessService,
    private webhook: WebhookService,
  ) {}

  @Post('webhook/:userId/:webhookId')
  @Public()
  @HttpCode(200)
  receive(@Req() req: Request, @Param('userId') userId: string, @Param('webhookId') webhookId: string) {
    const body = typeof req.body === 'string' ? req.body : '';
    const apiKey = findApiKey(req, body);
    if (!apiKey) throw new UnauthorizedException('Missing API key');
    return this.webhook.receive({userId, webhookId, apiKey, body, contentType: req.headers['content-type'], headers: req.headers});
  }

  @Get('devices/:id/webhooks')
  async list(@UserId() u: string, @Param('id') id: string) {
    return this.webhook.list(await this.access.ownedDevice(u, id));
  }

  @Post('devices/:id/webhooks')
  async create(@UserId() u: string, @Param('id') id: string) {
    return this.webhook.create(await this.access.ownedDevice(u, id));
  }

  @Post('devices/:id/webhooks/:webhookId/rotate-key')
  async rotateKey(@UserId() u: string, @Param('id') id: string, @Param('webhookId', ParseUUIDPipe) webhookId: string) {
    return this.webhook.rotateKey(await this.access.ownedDevice(u, id), webhookId);
  }

  @Delete('devices/:id/webhooks/:webhookId')
  async remove(@UserId() u: string, @Param('id') id: string, @Param('webhookId', ParseUUIDPipe) webhookId: string) {
    await this.webhook.remove(await this.access.ownedDevice(u, id), webhookId);
    return {ok: true};
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
