import { UserDto } from './user';
import { Gender } from '../enums';

// API Contract §4 — request/response shapes for the auth module.

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface RegisterRequestDto {
  email: string;
  password: string;
  display_name: string;
  mis_id: string;
  gender: Gender;
  requested_role: 'viewer' | 'student' | 'admin';
}

export interface SessionDto {
  id: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  ip_address: string;
  user_agent: string;
  is_current: boolean;
}

export interface LoginSuccessResponseDto {
  user: UserDto;
  session: SessionDto;
}

export interface LoginTwoFactorRequiredResponseDto {
  two_factor_required: true;
  pending_token: string;
}

export type LoginResponseDto = LoginSuccessResponseDto | LoginTwoFactorRequiredResponseDto;

export interface TwoFactorVerifyRequestDto {
  pending_token: string;
  code: string;
}

export interface TwoFactorEnrollResponseDto {
  provisioning_uri: string;
  recovery_codes: string[];
}

export interface PasswordResetRequestDto {
  email: string;
}

export interface PasswordResetConfirmDto {
  token: string;
  new_password: string;
}

export interface StepUpRequestDto {
  password: string;
  totp_code: string | null;
}

export interface StepUpResponseDto {
  step_up_verified_until: string;
}
