// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { deviceAccountHome, readDeviceAccounts, removeDeviceAccount, saveDeviceAccounts } from "./device-account-vault";

beforeEach(() => localStorage.clear());

describe("device account vault", () => {
  it("keeps only locally authenticated sessions and removes only local access", () => {
    saveDeviceAccounts([{ id: "teacher-1", name: "محمد", kind: "teacher", accessToken: "access", refreshToken: "refresh", expiresAt: null }]);
    expect(readDeviceAccounts().map(({ id }) => id)).toEqual(["teacher-1"]);
    expect(localStorage.getItem("emawahib.device-accounts.v1")).not.toContain("password");
    removeDeviceAccount("teacher-1");
    expect(readDeviceAccounts()).toEqual([]);
  });

  it("routes every restored account to its authorized workspace", () => {
    expect(deviceAccountHome("student")).toBe("/student");
    expect(deviceAccountHome("parent")).toBe("/family");
    expect(deviceAccountHome("teacher")).toBe("/teacher");
    expect(deviceAccountHome("admin")).toBe("/admin");
    expect(deviceAccountHome("direction")).toBe("/admin");
  });
});
