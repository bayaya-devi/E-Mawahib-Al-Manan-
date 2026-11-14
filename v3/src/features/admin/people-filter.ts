import type { CommandPerson } from "./models";

export function filterAdminPeople(
  people: CommandPerson[],
  kind: "student" | "teacher",
  query: string,
  detailFilter: string,
  statusFilter: string,
): CommandPerson[] {
  return people.filter(
    (person) =>
      person.role === kind &&
      (statusFilter === "all" || person.status === statusFilter) &&
      (detailFilter === "all" ||
        (detailFilter.startsWith("class:")
          ? person.classId === detailFilter.slice(6)
          : person.gender === detailFilter)) &&
      normalizePersonSearch(person.name).includes(normalizePersonSearch(query)),
  );
}

function normalizePersonSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .toLocaleLowerCase("ar");
}
