export type StudentStage = "neutral" | "child" | "teen" | "adult";

export function getStudentStage(dateOfBirth: string | null | undefined, today = new Date()): StudentStage {
  if (!dateOfBirth) return "neutral";

  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(birthDate.getTime()) || birthDate > today) return "neutral";

  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayHasPassed = today.getMonth() > birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!birthdayHasPassed) age -= 1;

  if (age < 5) return "neutral";
  if (age <= 8) return "child";
  if (age <= 18) return "teen";
  return "adult";
}
