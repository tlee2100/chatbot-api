import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { UserDto } from 'src/user/dto/user.dto';
import * as qrcode from 'qrcode';
import * as OTPAuth from 'otpauth';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Verify2faLoginDto } from './dto/verify-2fa-login.dto';
import { Confirm2faDto } from './dto/confirm-2fa.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenService } from './refresh-token.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';

interface RecaptchaVerifyResponse {
  success: boolean;
  score: number;
}

@Injectable()
export class AuthService {
  private readonly accessTokenTtl: number;

  private readonly refreshTokenTtl: number;

  private readonly refreshSecret: string;

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {
    this.accessTokenTtl = Number(this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? 900);
    this.refreshTokenTtl = Number(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? 604800,
    );
    this.refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET')!;
  }

  private async issueTokens(user: { id: number; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.accessTokenTtl,
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshTokenTtl,
    });

    await this.refreshTokenService.store(user.id, refreshToken, this.refreshTokenTtl);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.accessTokenTtl,
    };
  }

  private async verifyRecaptcha(token: string): Promise<boolean> {
    const secretKey = this.configService.get<string>('RECAPTCHA_SECRET_KEY');
    const response = await axios.post<RecaptchaVerifyResponse>(
      `https://www.google.com/recaptcha/api/siteverify`,
      null,
      { params: { secret: secretKey, response: token } },
    );
    // score >= 0.5 is real human
    return response.data.success && response.data.score >= 0.5;
  }

  async login(dto: LoginDto) {
    const recaptchaDisabled = this.configService.get<string>('DISABLE_RECAPTCHA') === 'true';
    if (!recaptchaDisabled) {
      const isHuman = await this.verifyRecaptcha(dto.recaptchaToken ?? '');
      if (!isHuman) {
        throw new UnauthorizedException('reCAPTCHA verification failed');
      }
    }

    const user = await this.userService.findOneWithPassword({
      email: dto.email,
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    //
    if (user.twoFactorEnabled) {
      return {
        twoFactorRequired: true,
        message: 'Please provide your 2FA code to complete login',
      };
    }

    const tokens = await this.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      ...tokens,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  async setupTwoFactor(userId: number) {
    const user = await this.userService.findOneWithPassword({ id: userId });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const fixedSecret = this.configService.get<string>('TWO_FACTOR_SECRET');
    const totp = new OTPAuth.TOTP({
      issuer: 'NestJS Auth App',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(fixedSecret!),
    });

    const secretBase32 = totp.secret.base32; // dạng string để lưu DB
    await this.userService.updateTwoFactorSecret(userId, secretBase32);

    const otpauthUrl = totp.toString();
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

    return {
      message: 'Scan this QR code with your authenticator app, then confirm with a code',
      qrCode: qrCodeDataUrl,
      secret: secretBase32,
    };
  }

  async confirmTwoFactor(userId: number, dto: Confirm2faDto) {
    const user = await this.userService.findOneWithPassword({ id: userId });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    //
    if (user.twoFactorEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }
    const fixedSecret = this.configService.get<string>('TWO_FACTOR_SECRET');

    const totp = new OTPAuth.TOTP({
      issuer: 'NestJS Auth App',
      label: 'user',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(fixedSecret!),
    });

    const delta = totp.validate({ token: dto.code, window: 1 });
    if (delta === null) {
      throw new BadRequestException('Invalid 2FA code');
    }

    // Lưu secret vào user, bật cờ enabled
    await this.userService.updateTwoFactorSecret(userId, fixedSecret!);
    await this.userService.setTwoFactorEnabled(userId, true);

    return { message: '2FA has been enabled successfully' };
  }

  async disableTwoFactor(userId: number, dto: Confirm2faDto) {
    const user = await this.userService.findOneWithPassword({ id: userId });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('2FA is not currently enabled');
    }

    const totp = new OTPAuth.TOTP({
      issuer: 'NestJS Auth App',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret),
    });

    const delta = totp.validate({ token: dto.code, window: 1 });
    if (delta === null) {
      throw new BadRequestException('Invalid 2FA code');
    }

    await this.userService.setTwoFactorEnabled(userId, false);
    await this.userService.updateTwoFactorSecret(userId, null);

    return { message: '2FA has been disabled' };
  }

  async verifyTwoFactorLogin(dto: Verify2faLoginDto) {
    const user = await this.userService.findOneWithPassword({
      email: dto.email,
    });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('2FA is not enabled for this account');
    }

    const totp = new OTPAuth.TOTP({
      issuer: 'NestJS Auth App',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret),
    });

    const delta = totp.validate({ token: dto.code, window: 1 });

    if (delta === null) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    const tokens = await this.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      ...tokens,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  async register(dto: CreateUserDto): Promise<UserDto> {
    return this.userService.create(dto);
  }

  async getTwoFactorStatus(userId: number) {
    const user = await this.userService.findOneWithPassword({ id: userId });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return { twoFactorEnabled: user.twoFactorEnabled };
  }

  async refreshTokens(dto: RefreshTokenDto) {
    let payload: { sub: number; email: string; role: string };
    try {
      payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const isValid = await this.refreshTokenService.verify(payload.sub, dto.refreshToken);
    if (!isValid) {
      // Không khớp bản lưu trong Redis — token đã bị revoke, hoặc là
      // một refresh token CŨ đã bị rotate rồi nhưng vẫn bị đem ra dùng lại
      // (dấu hiệu khả nghi) → từ chối luôn, không cấp token mới
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotation: mỗi lần refresh phát hành CẢ 2 token mới, ghi đè token cũ
    // trong Redis → refresh token cũ không dùng lại được nữa
    return this.issueTokens({
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    });
  }
}
