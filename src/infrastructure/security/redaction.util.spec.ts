import { redactObject, sanitizeErrorMessage } from "./redaction.util";

describe("redaction util", () => {
  it("redacts sensitive keys recursively", () => {
    const input = {
      authorization: "Bearer token-value",
      profile: {
        email: "a@b.com",
        nested: { password: "plain" },
      },
      safe: "ok",
    };

    const redacted = redactObject(input) as any;
    expect(redacted.authorization).toBe("[REDACTED]");
    expect(redacted.profile.email).toBe("[REDACTED]");
    expect(redacted.profile.nested.password).toBe("[REDACTED]");
    expect(redacted.safe).toBe("ok");
  });

  it("masks bearer token text from error messages", () => {
    const message = "Auth failed: Bearer abc.def.ghi";
    expect(sanitizeErrorMessage(message)).toContain("Bearer [REDACTED]");
  });
});
