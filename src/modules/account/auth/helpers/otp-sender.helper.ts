import { geezSmsRequestService } from "@api";

// ─── GeezSMS configuration ────────────────────────────────────────────────────
const GEEZ_TOKEN   = process.env.GEEZSMS_TOKEN || "";
const GEEZ_MSG     = process.env.GEEZSMS_MESSAGE || "Your verification code is: {code}. Do not share this code with anyone.";

// ─── Shared types (kept identical so callers need no changes) ─────────────────

export interface SendOTPResult {
  status: string;
  sentMessage?: string;
  phone: string;
  verificationId: string;
  otp: string;
}

export interface VerifyOTPResult {
  phone: string;
  code: string;
  verificationId: string;
  sentAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateCode(length: number): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

/** Normalize to the format GeezSMS expects: 09XXXXXXXX or 2519XXXXXXXX */
function normalizeForGeez(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // If already 10 digits starting with 09 → keep as-is
  if (/^09\d{8}$/.test(digits)) return digits;
  // 9 digits → prepend 0
  if (/^9\d{8}$/.test(digits)) return `0${digits}`;
  // 12 digits starting with 251 → replace prefix with 0
  if (/^2519\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  // +251... → strip + then recurse
  if (phone.startsWith("+")) return normalizeForGeez(digits);
  return digits;
}

// ─── Send OTP ─────────────────────────────────────────────────────────────────

/**
 * Send OTP via GeezSMS.
 * Falls back to local dev OTP when GEEZSMS_TOKEN is not set or API is unreachable in non-production.
 */
export async function sendOTP(
  phoneNumber: string,
  codeLength: number = 4,
  _codeType: number = 0,
): Promise<SendOTPResult> {
  const phone = normalizeForGeez(phoneNumber);
  if (!phone) throw new Error("Invalid phone number");

  // ── Dev fallback: no token configured or placeholder token ───────────────
  const isPlaceholder = !GEEZ_TOKEN || GEEZ_TOKEN.startsWith("your-");
  if (isPlaceholder) {
    const otp = generateCode(codeLength);
    const verificationId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    console.log(`[OTP send] ${phone} => ${otp} (verificationId: ${verificationId}) [NO SMS — token not configured]`);
    return { status: "success", phone, verificationId, otp };
  }

  // ── Generate code locally — GeezSMS sends it via SMS ──────────────────────
  const otp = generateCode(codeLength);
  const message = GEEZ_MSG.replace("{code}", otp);

  try {
    const data = await geezSmsRequestService.sendOtp({
      token: GEEZ_TOKEN,
      phone,
      msg: message,
    });

    // GeezSMS returns { success: true, data: { ... } }
    if (data?.success === true || data?.status === "success") {
      const verificationId = data?.data?.id
        ?? data?.id
        ?? `geez_${Date.now()}`;
      return {
        status: "success",
        phone,
        sentMessage: message,
        otp,                  // stored in DB for verification
        verificationId,
      };
    }

    const errMsg = data?.message || data?.error || "GeezSMS send failed";
    console.error("[OTP] GeezSMS send error:", data);
    throw new Error(errMsg);

  } catch (err: any) {
    // Non-production: fall back to local OTP so dev/staging work without credentials
    if (process.env.NODE_ENV !== "production") {
      const msg = err.response?.data?.message || err.message || "GeezSMS request failed";
      console.warn(`[OTP] GeezSMS send failed (${msg}); using local OTP for testing.`);
      const verificationId = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      console.log(`[OTP send] ${phone} => ${otp} (verificationId: ${verificationId})`);
      return { status: "success", phone, verificationId, otp };
    }
    if (err.response?.data) {
      throw new Error(err.response.data?.message || err.response.data?.error || "Failed to send OTP");
    }
    throw err;
  }
}

// ─── Verify OTP ───────────────────────────────────────────────────────────────

/**
 * Verify OTP via GeezSMS.
 * The code is also checked against the stored DB value by the calling service —
 * this call acts as an extra server-side validation.
 */
export async function verifyOTP(
  phoneNumber: string,
  verificationId: string,
  code: string,
): Promise<VerifyOTPResult> {
  const phone = normalizeForGeez(phoneNumber);

  // Dev/no-token path — caller already verified code against stored OTP
  const isPlaceholder = !GEEZ_TOKEN || GEEZ_TOKEN.startsWith("your-");
  if (isPlaceholder || verificationId.startsWith("dev_")) {
    return { phone, code, verificationId, sentAt: new Date().toISOString() };
  }

  try {
    const data = await geezSmsRequestService.verifyOtp({
      token: GEEZ_TOKEN,
      phone,
      code,
    });

    if (data?.success === true || data?.status === "success") {
      return {
        phone,
        code,
        verificationId,
        sentAt: data?.data?.sentAt ?? new Date().toISOString(),
      };
    }

    throw new Error(data?.message || "OTP verification failed");

  } catch (err: any) {
    if (err.response?.status === 400 || err.status === 400 || err.response?.data?.success === false) {
      throw new Error("Invalid or expired OTP");
    }
    // Non-production: treat as success when API unreachable (code already validated in DB)
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[OTP] GeezSMS verify failed (${err.message}); treating as success for testing.`);
      return { phone, code, verificationId, sentAt: new Date().toISOString() };
    }
    throw err;
  }
}
