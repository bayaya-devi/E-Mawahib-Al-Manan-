import { describe, expect, it } from "vitest";

import type { CommandPerson } from "./models";
import { filterAdminPeople } from "./people-filter";

const person = (overrides: Partial<CommandPerson>): CommandPerson => ({
  id: crypto.randomUUID(),
  name: "طالب تجريبي",
  firstName: "طالب",
  lastName: "تجريبي",
  role: "student",
  status: "active",
  deletedAt: null,
  classId: "class-a",
  className: "أ",
  classIds: [],
  age: null,
  gender: "male",
  phone: null,
  email: null,
  monthlyAmount: 0,
  guardianName: null,
  guardianPhone: null,
  guardianSecondaryPhone: null,
  canLeaveAlone: false,
  dateOfBirth: null,
  ageCategory: null,
  identityDocumentReceived: false,
  birthCertificateReceived: false,
  guardianIdentityReceived: false,
  accessibilityNotes: null,
  teacherIds: [],
  absences: 0,
  late: 0,
  mastered: 0,
  lastActivity: null,
  ...overrides,
});

describe("filterAdminPeople", () => {
  const people = [
    person({ id: "active", status: "active" }),
    person({
      id: "archived",
      status: "archived",
      deletedAt: "2026-11-14T00:00:00Z",
    }),
    person({ id: "suspended", status: "suspended" }),
    person({ id: "teacher", role: "teacher", status: "archived" }),
  ];

  it("shows active accounts by default and exposes archived accounts explicitly", () => {
    expect(
      filterAdminPeople(people, "student", "", "all", "active").map(
        ({ id }) => id,
      ),
    ).toEqual(["active"]);
    expect(
      filterAdminPeople(people, "student", "", "all", "archived").map(
        ({ id }) => id,
      ),
    ).toEqual(["archived"]);
  });

  it("keeps role, class, and search filters when all statuses are requested", () => {
    expect(
      filterAdminPeople(
        people,
        "student",
        "تجريبي",
        "class:class-a",
        "all",
      ).map(({ id }) => id),
    ).toEqual(["active", "archived", "suspended"]);
  });
});
