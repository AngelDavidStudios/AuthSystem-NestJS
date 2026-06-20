import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import {
  CurrentUser,
  type CurrentUserData,
} from '../auth/decorators/current-user.decorator';
import { MessagesService } from './messages.service';
import { MessageActionDto } from './dto/message-action.dto';

/**
 * `POST /messages` — endpoint único con dispatch por `{ action, ...params }`
 * (mismo patrón que `/vacation`). La identidad del remitente sale de la sesión
 * iron-session (cookie), nunca del body. El contenido sensible viaja cifrado con
 * KMS (envelope encryption); ver MessagesService.
 */
@Controller('messages')
@UseGuards(SessionAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  dispatch(
    @Body() dto: MessageActionDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    switch (dto.action) {
      case 'send':
        return this.messages.send(
          {
            subject: req(dto.subject, 'subject'),
            type: req(dto.type, 'type'),
            employee: req(dto.employee, 'employee'),
            eventDate: req(dto.eventDate, 'eventDate'),
            confidentialityLevel: req(
              dto.confidentialityLevel,
              'confidentialityLevel',
            ),
            description: req(dto.description, 'description'),
          },
          user,
        );

      case 'list':
        return this.messages.list();

      case 'decrypt':
        return this.messages.decrypt(req(dto.messageId, 'messageId'));

      case 'delete':
        return this.messages.delete(req(dto.messageId, 'messageId'), user);
    }
  }
}

/** Asegura que un parámetro requerido por la acción esté presente. */
function req<T>(value: T | undefined, name: string): T {
  if (value === undefined || value === null || value === '') {
    throw new BadRequestException(`Falta el parámetro requerido: ${name}`);
  }
  return value;
}
