import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signToken(user) {
  return jwt.sign(
    { email: user.email },
    env.JWT_SECRET,
    { subject: String(user.id), expiresIn: env.JWT_EXPIRES_IN }
  );
}
