export function resolveCareerLinkUsage(
  careerLinked: boolean | null | undefined,
  accountDefault: boolean,
): boolean {
  return careerLinked ?? accountDefault;
}
