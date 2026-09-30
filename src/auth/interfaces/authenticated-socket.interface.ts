import { Socket, DefaultEventsMap } from 'socket.io';
import { AuthenticatedUser } from './authenticated-user.interface';

export interface SocketData {
  user?: AuthenticatedUser;
}

export type AuthenticatedSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;
