const supported = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];

/** IANA timezone names for pickers (UTC is not always included by the runtime). */
export const TIMEZONES: string[] = supported.includes("UTC") ? supported : ["UTC", ...supported];
