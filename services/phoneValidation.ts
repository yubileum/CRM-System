/**
 * Phone number validation for registration.
 *
 * Input: country code (digits only, e.g. "62") and local number
 * (digits only, without leading 0, e.g. "81234567890").
 *
 * Returns an error message string, or null if the number looks valid.
 */

// Valid Indonesian mobile prefixes (after dropping the leading 0):
// 81x Telkomsel, 82x Telkomsel, 83x Axis, 85x Telkomsel/Indosat,
// 87x XL, 88x Smartfren, 89x Tri
const ID_MOBILE_REGEX = /^8[1235789]\d{7,10}$/; // total 9–12 digits

/** True if the string is made of a short block (1–4 digits) repeated, e.g. 606060, 123123, 7777. */
const isRepeatingPattern = (digits: string): boolean => {
  for (let period = 1; period <= 4; period++) {
    if (digits.length < period * 2) break;
    const block = digits.substring(0, period);
    const repeated = block.repeat(Math.ceil(digits.length / period)).substring(0, digits.length);
    if (repeated === digits) return true;
  }
  return false;
};

/** True if the string is an ascending or descending run, e.g. 1234567, 9876543. */
const isSequential = (digits: string): boolean => {
  if (digits.length < 5) return false;
  let asc = true;
  let desc = true;
  for (let i = 1; i < digits.length; i++) {
    const diff = Number(digits[i]) - Number(digits[i - 1]);
    if (diff !== 1 && diff !== -9) asc = false;
    if (diff !== -1 && diff !== 9) desc = false;
  }
  return asc || desc;
};

const isJunkNumber = (digits: string): boolean =>
  isRepeatingPattern(digits) || isSequential(digits);

export const validatePhoneNumber = (countryCode: string, phone: string): string | null => {
  const cc = countryCode.replace(/\D/g, '');
  const num = phone.replace(/\D/g, '').replace(/^0+/, '');

  if (!cc) return 'Please enter a country code.';
  if (!num) return 'Please enter your phone number.';

  if (cc === '62') {
    if (!ID_MOBILE_REGEX.test(num)) {
      return 'Please enter a valid Indonesian mobile number (starts with 8, e.g. 812xxxxxxxx).';
    }
    // Check the subscriber part (after the 3-digit operator prefix, e.g. "812")
    const subscriber = num.substring(3);
    if (isJunkNumber(num) || isJunkNumber(subscriber)) {
      return 'This phone number does not look valid. Please enter your real number.';
    }
    return null;
  }

  // Other countries: E.164 allows max 15 digits total
  if (num.length < 7 || cc.length + num.length > 15) {
    return 'Please enter a valid phone number.';
  }
  if (isJunkNumber(num)) {
    return 'This phone number does not look valid. Please enter your real number.';
  }
  return null;
};
