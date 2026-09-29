import * as bcrypt from "bcrypt";
import { Util } from "./util";

describe("Util password security", () => {
  it("hashes passwords using Argon2", async () => {
    const hash = await Util.hashPassword("S3curePass!");
    expect(hash.startsWith("$argon2")).toBe(true);
  });

  it("verifies Argon2 hashes", async () => {
    const hash = await Util.hashPassword("S3curePass!");
    await expect(Util.comparePassword("S3curePass!", hash)).resolves.toBe(true);
    await expect(Util.comparePassword("wrong", hash)).resolves.toBe(false);
  });

  it("keeps backward compatibility with bcrypt hashes", async () => {
    const legacyHash = bcrypt.hashSync("LegacyPass1", 10);
    await expect(Util.comparePassword("LegacyPass1", legacyHash)).resolves.toBe(true);
    await expect(Util.comparePassword("wrong", legacyHash)).resolves.toBe(false);
  });
});
