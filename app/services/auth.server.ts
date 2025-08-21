import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '~/utils/db.server';
import type { User } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-this';
const JWT_EXPIRES_IN = '30d';
const SALT_ROUNDS = 10;

export interface JWTPayload {
  userId: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateTokens(user: User): AuthTokens {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    return { accessToken };
  }

  static verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  static async createUser(email: string, password: string, name?: string) {
    const hashedPassword = await this.hashPassword(password);
    
    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    return user;
  }

  static async authenticateUser(email: string, password: string) {
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await this.verifyPassword(password, user.password);
    
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    return user;
  }

  static async getUserById(userId: string) {
    return db.user.findUnique({
      where: { id: userId },
    });
  }

  static async getUserFromToken(token: string) {
    const payload = this.verifyToken(token);
    return this.getUserById(payload.userId);
  }

  static extractTokenFromRequest(request: Request): string | null {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split('; ').map(c => c.split('='))
      );
      return cookies.auth_token || null;
    }

    return null;
  }
}