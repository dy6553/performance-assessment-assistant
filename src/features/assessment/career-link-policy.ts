export function resolveCareerLinkUsage(
  careerLinked: boolean | null | undefined,
  _accountDefault: boolean,
): boolean {
  return careerLinked === true;
}
