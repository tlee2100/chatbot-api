import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    // Return the user object if authenticated, or null if not.
    // Do not throw an error if unauthenticated.
    return user || null;
  }
}
