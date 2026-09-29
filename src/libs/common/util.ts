import * as bcrypt from "bcrypt";
import * as argon2 from "argon2";
import { UserInfo } from "@account/auth/dtos/user-info.dto";
import * as jwt from "jsonwebtoken";
export class Util {
  static async hashPassword(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, {
      type: argon2.argon2id,
      timeCost: Number(process.env.ARGON2_TIME_COST) || 3,
      memoryCost: Number(process.env.ARGON2_MEMORY_COST) || 65536,
      parallelism: Number(process.env.ARGON2_PARALLELISM) || 1,
    });
  }
  static async comparePassword(
    plainPassword: string,
    encryptedPassword: string
  ): Promise<boolean> {
    try {
      if (!encryptedPassword) {
        return false;
      }

      // Primary verification path for Argon2id hashes.
      if (encryptedPassword.startsWith("$argon2")) {
        return await argon2.verify(encryptedPassword, plainPassword);
      }

      // Backward compatibility for legacy bcrypt hashes.
      if (encryptedPassword.startsWith("$2")) {
        return bcrypt.compareSync(plainPassword, encryptedPassword);
      }

      return false;
    } catch {
      return false;
    }
  }
  static generatePassword(length = 4): string {
    let password = "";
    const characters = "0123456789";
    // const characters =
    //   "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*()-";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      password += characters.charAt(
        Math.floor(Math.random() * charactersLength)
      );
    }
    return password;
  }
  static getTimeDifference(endTime: Date, startTime: Date): string {
    const diff = endTime.getTime() - startTime.getTime();
    let msec = diff;
    const hh = Math.floor(msec / 1000 / 60 / 60);
    msec -= hh * 1000 * 60 * 60;
    const mm = Math.floor(msec / 1000 / 60);
    msec -= mm * 1000 * 60;
    const ss = Math.floor(msec / 1000);
    msec -= ss * 1000;
    let result = hh ? hh.toString() : "00";
    result += ":" + (mm.toString() ? mm.toString() : "00");
    result += ":" + (ss.toString() ? ss.toString() : "00");
    return result;
  }
  static getPasswordFromCurrentDate(): string {
    const currentDate = new Date();
    const month =
      currentDate.getMonth() > 9
        ? currentDate.getMonth().toString()
        : "0" + currentDate.getMonth().toString();
    const date =
      currentDate.getDate() > 9
        ? currentDate.getDate().toString()
        : "0" + currentDate.getDate().toString();
    return currentDate.getFullYear().toString() + month + date;
  }
  static getTheLastMonday(date: Date) {
    const previousMonday = new Date();
    previousMonday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return previousMonday;
  }
  static GenerateToken(
    user: UserInfo,
    expiresIn: jwt.SignOptions["expiresIn"] = "30d"
  ) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET is not configured");
    }
    return jwt.sign(user, secret, {
      expiresIn,
    });
  }
  static GenerateRefreshToken(
    user: UserInfo,
    expiresIn: jwt.SignOptions["expiresIn"] = "36500d"
  ) {
    const refreshSecret = process.env.REFRESH_SECRET_TOKEN;
    if (!refreshSecret) {
      throw new Error("REFRESH_SECRET_TOKEN is not configured");
    }
    return jwt.sign(user, refreshSecret, {
      expiresIn,
    });
  }
  static normalizePhone(phone: string): string {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "").trim();
    return digits.length > 9 ? digits.slice(-9) : digits;
  }
  static compareDate(date1: Date, date2: Date) {
    return date1.getTime() - date2.getTime();
  }
}
