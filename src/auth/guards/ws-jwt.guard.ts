import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { AuthenticatedSocket } from '../interfaces/authenticated-socket.interface';
import { Role } from '../../user/enums/role.enum';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  //
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    this.authenticate(client);
    return true;
  }

  //
  authenticate(client: AuthenticatedSocket): AuthenticatedUser {
    const token = this.extractToken(client);
    try {
      const payload = this.jwtService.verify<{ sub: number; email: string; role: Role }>(token);
      const user: AuthenticatedUser = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      // eslint-disable-next-line no-param-reassign -- `socket.data` is Socket.IO's designated per-connection state store
      client.data.user = user;
      return user;
    } catch {
      throw new UnauthorizedException('Invalid or missing WebSocket token');
    }
  }

  private extractToken(client: Socket): string {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) return authToken;

    const queryToken = client.handshake.query?.token as string | undefined;
    if (queryToken) return queryToken;

    const authHeader = client.handshake.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length);
    }

    throw new UnauthorizedException('Missing authentication token');
  }
}
