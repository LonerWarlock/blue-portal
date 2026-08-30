const JAVA_COURSE_TEST_MODE = false;
const ACTIVE_COURSE_FEE = JAVA_COURSE_TEST_MODE ? 1 : 2500;
const PAYU_STANDARD_RATE = 0.02;
const GST_RATE = 0.18;
const roundCurrency = (amount: number) => Math.round(amount * 100) / 100;
const formatCurrency = (amount: number) =>
  `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const GATEWAY_FEE = roundCurrency(ACTIVE_COURSE_FEE * PAYU_STANDARD_RATE * (1 + GST_RATE));
const TOTAL_PAYABLE = roundCurrency(ACTIVE_COURSE_FEE + GATEWAY_FEE);

export const JAVA_COURSE = {
  title: "Java Launchpad",
  subtitle: "From first program to production-ready backend",
  cohort: "September 2026 cohort",
  duration: "8 weeks",
  format: "Live online",
  pace: "3 sessions / week",
  seats: 40,
  testMode: JAVA_COURSE_TEST_MODE,
  productionFee: 2500,
  fee: ACTIVE_COURSE_FEE,
  feePayU: ACTIVE_COURSE_FEE.toFixed(2),
  feeLabel: formatCurrency(ACTIVE_COURSE_FEE),
  gatewayRate: PAYU_STANDARD_RATE,
  gatewayGstRate: GST_RATE,
  gatewayFee: GATEWAY_FEE,
  gatewayFeeLabel: formatCurrency(GATEWAY_FEE),
  totalPayable: TOTAL_PAYABLE,
  totalPayablePayU: TOTAL_PAYABLE.toFixed(2),
  totalPayableLabel: formatCurrency(TOTAL_PAYABLE),
  productInfo: "Java Launchpad - Live Online Course",
  supportEmail: "support@imergene.in",
  whatsappGroupUrl: "https://chat.whatsapp.com/KNPJ4cQRENdLiTO6aMllME",
} as const;

export const JAVA_COURSE_TRACKS = [
  {
    number: "01",
    title: "Java foundations",
    description: "Syntax, OOP, collections, exceptions, generics, streams, and clean-code habits.",
  },
  {
    number: "02",
    title: "Backend development",
    description: "REST APIs with Spring Boot, validation, authentication, testing, and documentation.",
  },
  {
    number: "03",
    title: "Data & deployment",
    description: "PostgreSQL, JPA and Hibernate, Docker fundamentals, observability, and cloud deployment.",
  },
  {
    number: "04",
    title: "Capstone project",
    description: "Ship a portfolio-ready backend with code reviews, team workflows, and a final demo.",
  },
] as const;

export const EXPERIENCE_OPTIONS = [
  "Complete beginner",
  "I know programming basics",
  "I have used Java before",
  "I work with Java professionally",
] as const;

export const STATUS_OPTIONS = [
  "School student",
  "College student",
  "Recent graduate",
  "Working professional",
  "Career switcher",
  "Other",
] as const;

export const SCHEDULE_OPTIONS = [
  "Weekday evenings",
  "Weekend mornings",
  "Weekend evenings",
  "I am flexible",
] as const;
