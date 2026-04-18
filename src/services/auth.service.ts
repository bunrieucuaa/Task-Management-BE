import { ApiResponse } from "@/dtos/api-response.dto";
import { ILoginResponseData } from "@/shared/interfaces/IAuth";
import { getUserByEmail } from "./user.service";
import { user_status } from "@/generated/prisma/enums";
import { verifyPassword } from "@/utils/password.util";

/**
 * Authenticate user and generate JWT token
 * @param email email
 * @param password Password
 * @returns Login response with user info and access token
 */
export const login = async (
    email: string,
    password: string,
  ): Promise<ApiResponse<ILoginResponseData>> => {
    // Get user by email
    const user = await getUserByEmail(email);
  
    if (!user) {
      throw new Error('Email hoặc password không hợp lệ');
    }
  
    // Check if user is disabled
    if (user.status === user_status.INACTIVE) {
      throw new Error('Tài khoản người dùng không hoạt động');
    }
  
    // Verify password with salt
    const isValidPassword = await verifyPassword(password, user.password_hash, user.password_salt);
  
    if (!isValidPassword) {
      throw new Error('Invalid username or password');
    }
  
    // Check if user must change password
    // Generate token anyway, but mark it as requiring password change
    const accessToken = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.token_version,
    });
  
    const responseData: ILoginResponseData = {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      accessToken,
      mustChangePassword: user.mustChangePassword,
    };
  
    if (user.mustChangePassword) {
      return createSuccessResponse(
        responseData,
        'Login successful, but you must change your password',
      );
    }
  
    return createSuccessResponse(responseData, 'Login successful');
  };

  
  