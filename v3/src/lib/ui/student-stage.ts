export type StudentStage = "neutral" | "child" | "teen" | "adult";
export type StudentAgeCategory = "CHILD_5_8" | "TEEN_9_18" | "ADULT_19_PLUS";

export function getStudentStage(category: StudentAgeCategory | null | undefined): StudentStage {
  if (category === "CHILD_5_8") return "child";
  if (category === "TEEN_9_18") return "teen";
  if (category === "ADULT_19_PLUS") return "adult";
  return "neutral";
}
