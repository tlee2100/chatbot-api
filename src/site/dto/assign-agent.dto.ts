import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class AssignAgentDto {
  @ApiProperty({ example: 2, description: 'ID of the agent (user) to assign to this site' })
  @IsInt()
  @IsPositive()
  agentId!: number;
}
