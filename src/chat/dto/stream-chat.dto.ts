import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class StreamChatDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsArray()
  @IsNotEmpty()
  messages: Array<any>;

  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  trigger?: string;

  @IsString()
  @IsOptional()
  messageId?: string;
}

