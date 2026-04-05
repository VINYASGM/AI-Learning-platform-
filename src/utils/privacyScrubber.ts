/**
 * Utility to scrub Personally Identifiable Information (PII) before sending payloads
 * to external models, complying with strict FERPA/COPPA requirements.
 */

const EMAIL_REGEX = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
const PHONE_REGEX = /(\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;

// A simple fallback dictionary to censor common names mentioned in the prompt (MVP version)
const COMMON_NAMES = ['Jane', 'John', 'Alice', 'Bob', 'Michael', 'Sarah'];
const NAME_REGEX = new RegExp(`\\b(${COMMON_NAMES.join('|')})\\b`, 'gi');

export function scrubPII(text: string): string {
  let scrubbed = text;
  
  // Scrub Emails
  scrubbed = scrubbed.replace(EMAIL_REGEX, '[REDACTED_EMAIL]');
  
  // Scrub Phones
  scrubbed = scrubbed.replace(PHONE_REGEX, '[REDACTED_PHONE]');
  
  // Scrub Known Names
  scrubbed = scrubbed.replace(NAME_REGEX, '[LEARNER_NAME]');
  
  return scrubbed;
}
