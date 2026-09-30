import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiResponse, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Confirm2faDto } from './dto/confirm-2fa.dto';
import { Verify2faLoginDto } from './dto/verify-2fa-login.dto';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Log in and receive a JWT access token' })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns access_token',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiOperation({ summary: 'Start 2FA setup — returns QR code and secret' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Post('setup-2fa')
  async setupTwoFactor(@Request() req: AuthenticatedRequest) {
    return this.authService.setupTwoFactor(req.user.id);
  }

  @ApiOperation({ summary: 'Confirm 2FA setup with a 6-digit code' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Post('confirm-2fa')
  async confirmTwoFactor(@Body() dto: Confirm2faDto, @Request() req: AuthenticatedRequest) {
    return this.authService.confirmTwoFactor(req.user.id, dto);
  }

  @ApiOperation({ summary: 'Register a new account (always created as AGENT)' })
  @Post('register')
  async register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  @ApiOperation({ summary: 'Disable 2FA after verifying current TOTP code' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Post('disable-2fa')
  async disableTwoFactor(@Body() dto: Confirm2faDto, @Request() req: AuthenticatedRequest) {
    return this.authService.disableTwoFactor(req.user.id, dto);
  }

  @ApiOperation({ summary: 'Complete login by verifying the 2FA code' })
  @Post('verify-2fa-login')
  async verifyTwoFactorLogin(@Body() dto: Verify2faLoginDto) {
    return this.authService.verifyTwoFactorLogin(dto);
  }

  @ApiOperation({ summary: 'Get current 2FA status for the logged-in user' })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'))
  @Post('2fa-status')
  async getTwoFactorStatus(@Request() req: AuthenticatedRequest) {
    return this.authService.getTwoFactorStatus(req.user.id);
  }

  @ApiOperation({ summary: 'Exchange a valid refresh token for a new token pair' })
  @ApiResponse({ status: 200, description: 'New access_token and refresh_token issued' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto);
  }
}
