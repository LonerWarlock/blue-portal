import {
  EXPERIENCE_OPTIONS,
  SCHEDULE_OPTIONS,
  STATUS_OPTIONS,
} from "@/app/courses/java/config";

export type JavaRegistrationData = {
  fullName: string;
  email: string;
  phone: string;
  city: string;
  currentStatus: string;
  experience: string;
  preferredSchedule: string;
  learningGoal: string;
  consent: true;
};

type ValidationResult =
  | { ok: true; data: JavaRegistrationData }
  | { ok: false; error: string };

const cleanText = (value: unknown, maxLength: number) =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";

export function validateJavaRegistration(input: unknown): ValidationResult {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Invalid registration details." };
  }

  const body = input as Record<string, unknown>;
  const fullName = cleanText(body.fullName, 100);
  const email = cleanText(body.email, 150).toLowerCase();
  const phone = cleanText(body.phone, 20).replace(/[^\d+]/g, "");
  const city = cleanText(body.city, 80);
  const currentStatus = cleanText(body.currentStatus, 60);
  const experience = cleanText(body.experience, 80);
  const preferredSchedule = cleanText(body.preferredSchedule, 80);
  const learningGoal = cleanText(body.learningGoal, 600);

  if (fullName.length < 2) return { ok: false, error: "Please enter your full name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Please enter a valid email address." };
  if (!/^\+?\d{10,15}$/.test(phone)) return { ok: false, error: "Please enter a valid 10–15 digit phone number." };
  if (city.length < 2) return { ok: false, error: "Please enter your city." };
  if (!(STATUS_OPTIONS as readonly string[]).includes(currentStatus)) return { ok: false, error: "Please select your current status." };
  if (!(EXPERIENCE_OPTIONS as readonly string[]).includes(experience)) return { ok: false, error: "Please select your Java experience." };
  if (!(SCHEDULE_OPTIONS as readonly string[]).includes(preferredSchedule)) return { ok: false, error: "Please select a preferred schedule." };
  if (body.consent !== true) return { ok: false, error: "Please accept the privacy consent to enroll." };

  return {
    ok: true,
    data: {
      fullName,
      email,
      phone,
      city,
      currentStatus,
      experience,
      preferredSchedule,
      learningGoal,
      consent: true,
    },
  };
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] || character);
}
