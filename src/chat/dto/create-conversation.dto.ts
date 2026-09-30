import { IsEmail, IsNotEmpty, IsNumber, IsString, MinLength } from 'class-validator';

export class CreateConversationDto {
  @IsNumber()
  siteId: number;

  @IsString()
  @IsNotEmpty()
  visitorName: string;

  @IsEmail()
  visitorEmail: string;

  @IsString()
  @MinLength(1)
  firstMessage: string;
}
