# Profiles and first use

**Status:** Current  
**Last updated:** 29 September 2026

## First visit

Gitaverse requires a profile; there is no guest route. On first use, the person enters a name, exact date of birth, optional gender, preferred supported language, optional profile photo, and whether the profile should open automatically on this device.

The form states: “We collect anonymised information to improve the product experience.” It is informational, not an analytics opt-in. Names, dates of birth, and photos remain local and are masked from Clarity.

## Returning visits

When no default profile is set, Gitaverse displays all local profiles and lets the person choose one or add another. A default profile bypasses selection. The persistent profile pill opens actions to switch, edit, or manage profiles; those actions are not duplicated in the main menu.

After profile selection, Gitaverse either resumes the saved location or opens experience selection. Explicit URL parameters remain authoritative.

## Profile identity

Each device assigns an incremental numeric `pid`. Analytics uses an anonymous device/profile-derived identifier rather than the person’s name. Age is converted to a band at analytics time; under-13 ages are reported as unknown, and invalid or missing dates use the missing band.

See [Profiles and local storage](../system/profiles-and-local-storage.md) and [Events, analytics and resume](../system/events-analytics-and-resume.md).
