import { IsEmail, IsEnum, IsString, MinLength, Validate, Matches } from 'class-validator';
import { IsMisIdConstraint } from '../../users/dto/update-profile.dto';

export class SendRegistrationOtpDto {
  @IsEmail()
  email!: string;
}

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  otp!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  display_name!: string;

  // 9-digit college MIS ID. The institution's MIS scheme encodes
  // admission year / department / roll number in that string, but this
  // app deliberately only validates the shape (exactly 9 digits) and
  // uniqueness — it does not parse or infer anything from the digits
  // themselves (see the doc comment on `misId` in schema.prisma).
  @IsString()
  @Validate(IsMisIdConstraint)
  mis_id!: string;

  @IsEnum(['male', 'female', 'other', 'prefer_not_to_say'])
  gender!: 'male' | 'female' | 'other' | 'prefer_not_to_say';

  @IsString()
  @Matches(/^\+\d{10,15}$/, { message: 'WhatsApp number must include country code.' })
  whatsapp_number!: string;

  @IsString()
  @MinLength(1)
  subsystem!: string;

  @IsString()
  @MinLength(1)
  team_role!: string;

  @IsEnum(['viewer', 'student', 'admin'])
  requested_role!: 'viewer' | 'student' | 'admin';
}
