import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as dotenv from 'dotenv';

dotenv.config();

export class LoginDto {
  @ApiProperty({
    description: 'The email of the user',
    example: 'test@gmail.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'The password of the user',
    example: '123456',
  })
  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}

if (process.env.DISABLE_RECAPTCHA !== 'true') {
  ApiPropertyOptional({ description: 'reCAPTCHA v3 token from frontend' })(
    LoginDto.prototype,
    'recaptchaToken',
  );
}
