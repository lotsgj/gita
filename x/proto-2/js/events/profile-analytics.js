const GENDERS = new Set(['female', 'male', 'nonbinary', 'self-described']);

function validDateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function ageBand(dob, now = new Date()) {
  const birth = validDateParts(dob);
  if (!birth || Number.isNaN(now.getTime())) return 'missing';
  let age = now.getUTCFullYear() - birth.year;
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  if (month < birth.month || (month === birth.month && day < birth.day)) age -= 1;
  if (age < 0) return 'missing';
  if (age < 13) return 'unknown';
  if (age < 18) return '13-17';
  if (age < 25) return '18-24';
  if (age < 35) return '25-34';
  if (age < 45) return '35-44';
  if (age < 55) return '45-54';
  if (age < 65) return '55-64';
  if (age < 75) return '65-74';
  return '75-plus';
}

export function profileAnalyticsContext(profile, now = new Date()) {
  if (!profile) return {};
  return {
    ageBand: ageBand(profile.dob, now),
    genderGroup: GENDERS.has(profile.gender) ? profile.gender.replace('-', '_') : 'not_said',
    profileLanguage: profile.language === 'kn' ? 'kn' : 'en'
  };
}
