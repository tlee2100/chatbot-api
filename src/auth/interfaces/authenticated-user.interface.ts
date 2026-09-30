import { Role } from '../../user/enums/role.enum';

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: Role;
}
