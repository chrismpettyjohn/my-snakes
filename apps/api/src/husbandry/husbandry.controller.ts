import {LogService} from './log.service';
import {UserId} from '../auth/auth.guard';
import {ZodPipe} from '../common/zod.pipe';
import {SnakeService} from './snake.service';
import {AccessService} from '../common/access.service';
import {Body, Controller, Delete, Get, Param, Post, Put} from '@nestjs/common';
import {CreateLogInput, MoveSnakeInput, ReorderSnakesInput, UpsertSnakeInput} from '@snake/shared';

@Controller()
export class HusbandryController {
  constructor(
    private access: AccessService,
    private snake: SnakeService,
    private log: LogService,
  ) {}

  @Get('homes/:homeId/snakes')
  async listSnakes(@UserId() u: string, @Param('homeId') homeId: string) {
    await this.access.role(u, homeId);
    return this.snake.list(homeId);
  }

  @Post('homes/:homeId/snakes')
  async createSnake(@UserId() u: string, @Param('homeId') homeId: string, @Body(new ZodPipe(UpsertSnakeInput)) body: UpsertSnakeInput) {
    await this.access.role(u, homeId);
    return this.snake.create(homeId, body);
  }

  @Put('homes/:homeId/snakes/order')
  async reorderSnakes(@UserId() u: string, @Param('homeId') homeId: string, @Body(new ZodPipe(ReorderSnakesInput)) body: ReorderSnakesInput) {
    await this.access.role(u, homeId);
    await this.snake.reorder(homeId, body.ids);
    return {ok: true};
  }

  @Put('snakes/:id')
  async updateSnake(@UserId() u: string, @Param('id') id: string, @Body(new ZodPipe(UpsertSnakeInput)) body: UpsertSnakeInput) {
    await this.access.snake(u, id);
    return this.snake.update(id, body);
  }

  @Put('snakes/:id/home')
  async moveSnake(@UserId() u: string, @Param('id') id: string, @Body(new ZodPipe(MoveSnakeInput)) body: MoveSnakeInput) {
    const snake = await this.access.snake(u, id);
    await this.access.role(u, body.homeId);
    if (snake.homeId !== body.homeId) await this.snake.move(id, body.homeId);
    return {ok: true};
  }

  @Delete('snakes/:id')
  async deleteSnake(@UserId() u: string, @Param('id') id: string) {
    await this.access.snake(u, id);
    await this.snake.remove(id);
    return {ok: true};
  }

  @Get('snakes/:id/logs')
  async logsFor(@UserId() u: string, @Param('id') id: string) {
    await this.access.snake(u, id);
    return this.log.forSnake(id);
  }

  @Post('snakes/:id/logs')
  async addLog(@UserId() u: string, @Param('id') id: string, @Body(new ZodPipe(CreateLogInput)) body: CreateLogInput) {
    await this.access.snake(u, id);
    return this.log.add(id, u, body);
  }
}
