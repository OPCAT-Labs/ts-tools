/**
 * @ignore
 */
export function getValidatedHexString(hex: string, allowEmpty = true): string {
  const ret = hex.trim();

  if (ret.length < 1 && !allowEmpty) {
    throw new Error("can't be empty string");
  }

  if (ret.length % 2) {
    throw new Error(`<${ret}> should have even length`);
  }

  if (ret.length > 0 && !/^[\da-f]+$/i.test(ret)) {
    throw new Error(`<${ret}> should only contain [0-9] or characters [a-fA-F]`);
  }

  return ret;
}
