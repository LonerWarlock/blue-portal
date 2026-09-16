export const HACKATHON_FEE_PER_PERSON = 100;
export const HACKATHON_FEE_PER_PERSON_STR = `\u20B9${HACKATHON_FEE_PER_PERSON}`;

/** Calculate total fee based on team size (₹100 per person) */
export function getTeamFee(teamSize: number): number {
  return teamSize * HACKATHON_FEE_PER_PERSON;
}

export function getTeamFeeStr(teamSize: number): string {
  return `\u20B9${getTeamFee(teamSize)}`;
}

export function getTeamFeePayU(teamSize: number): string {
  return `${getTeamFee(teamSize)}.00`;
}

// Registration open: 20 September 2026 to 24 September 2026, 11:59 PM IST
export const REGISTRATION_START = new Date('2026-09-20T00:00:00+05:30');
export const REGISTRATION_DEADLINE = new Date('2026-09-24T23:59:59+05:30');

// Hackathon: 25-26 September 2026
export const HACKATHON_START = new Date('2026-09-25T00:00:00+05:30');
export const HACKATHON_END = new Date('2026-09-26T23:59:59+05:30');

export const EVENT_NAME = 'IGNITE 2026';

// Keep the old constant name as alias for backward compat in imports
export const HACKATHON_FEE = HACKATHON_FEE_PER_PERSON;
export const HACKATHON_FEE_STR = HACKATHON_FEE_PER_PERSON_STR;
