import { Controller, Get, Param, Patch, Post, Body, Query, Delete } from '@nestjs/common';
import { UserRole } from '@nest/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireStepUp } from '../auth/decorators/require-step-up.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SessionUser } from '../auth/guards/session-auth.guard';
import { UsersService } from './users.service';
import { ChangeRoleDto } from './dto/change-role.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { ApiExceptions } from '../common/dto/api-exception';

// API Contract §5. Every mutating route here is @RequireStepUp() per
// TDS §12.3's explicit list ("role/permission changes, user
// deactivation/deletion..."). GET /users/:id additionally allows self
// access (a user reading their own record) — implemented as a check
// inside the handler rather than a role-only guard, since "self OR
// admin" isn't expressible as a single minimum role.
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  async list(@Query() query: ListUsersQueryDto) {
    return this.usersService.list({
      role: query.role,
      isActive: query.is_active,
      hasPendingRole: query.has_pending_role,
      page: query.page ?? 1,
      pageSize: query.page_size ?? 25,
    });
  }

  @Patch('me/profile')
  async updateProfile(@Body() dto: UpdateProfileDto, @CurrentUser() caller: SessionUser) {
    return this.usersService.updateProfile(caller.id, dto);
  }

  @Patch('me/password')
  async updatePassword(@Body() dto: UpdatePasswordDto, @CurrentUser() caller: SessionUser) {
    return this.usersService.updatePassword(caller.id, dto);
  }

  @Post('me/request-role')
  async requestRole(@Body() dto: ChangeRoleDto, @CurrentUser() caller: SessionUser) {
    return this.usersService.requestRole(caller.id, dto.role);
  }

  @Delete('me')
  @RequireStepUp()
  async deleteAccount(@CurrentUser() caller: SessionUser) {
    return this.usersService.deleteAccount(caller.id);
  }

  @Get(':id')
  async getById(@Param('id') id: string, @CurrentUser() caller: SessionUser) {
    if (caller.role !== UserRole.ADMIN && caller.id !== id) {
      // Resource-level check (TDS §5.2 PolicyGuard concept) inlined here
      // since Phase 0 has exactly one such rule; extracted into a real
      // PolicyGuard once a second resource-level rule exists elsewhere
      // (avoids building an abstraction for a single use site).
      throw ApiExceptions.forbidden();
    }
    return this.usersService.findById(id);
  }

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  @RequireStepUp()
  async changeRole(
    @Param('id') id: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser() caller: SessionUser,
  ) {
    return this.usersService.changeRole(id, dto.role, caller.id);
  }

  @Post(':id/approve-role')
  @Roles(UserRole.ADMIN)
  @RequireStepUp()
  async approveRole(@Param('id') id: string, @CurrentUser() caller: SessionUser) {
    return this.usersService.approveRole(id, caller.id);
  }

  @Post(':id/reject-role')
  @Roles(UserRole.ADMIN)
  @RequireStepUp()
  async rejectRole(@Param('id') id: string, @CurrentUser() caller: SessionUser) {
    return this.usersService.rejectRole(id, caller.id);
  }

  @Post(':id/deactivate')
  @Roles(UserRole.ADMIN)
  @RequireStepUp()
  async deactivate(@Param('id') id: string, @CurrentUser() caller: SessionUser) {
    return this.usersService.deactivate(id, caller.id);
  }

  @Post(':id/reactivate')
  @Roles(UserRole.ADMIN)
  @RequireStepUp()
  async reactivate(@Param('id') id: string, @CurrentUser() caller: SessionUser) {
    return this.usersService.reactivate(id, caller.id);
  }
}
