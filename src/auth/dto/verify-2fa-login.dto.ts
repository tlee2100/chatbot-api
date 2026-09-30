import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class Verify2faLoginDto {
  @ApiProperty({ example: 'test@gmail.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit TOTP code from authenticator app',
  })
  @IsString()
  @Length(6, 6)
  code!: string;
}
