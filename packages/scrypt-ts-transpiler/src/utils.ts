import { createHash } from 'crypto';
import path, { extname } from 'path';
import ts from 'typescript';
import { fileURLToPath, pathToFileURL } from 'url';
import { getValidatedHexString, isSubBytes, ScryptType } from '@opcat-labs/scrypt-ts';
import { resolvePathSync } from 'mlly';
import fs from 'fs';
import { readdir } from 'fs/promises';

export function getBuiltInType(type: string): string {
  switch (type) {
    case 'bigint':
    case 'number':
      return 'int';
    case 'boolean':
      return 'bool';
    case 'PubKeyHash':
      return 'Ripemd160';
    case 'string':
      return 'bytes';
    case 'PubKey':
    case 'Sig':
    case 'Ripemd160':
    case 'Sha256':
    case 'Sha1':
    case 'SigHashType':
    case 'SigHashPreimage':
    case 'OpCodeType':
    case 'auto':
    case 'PrivKey':
      return type;
    default:
      return '';
  }
}

export function number2hex(val: number | bigint): string {
  let hex = val.toString(16);
  if (hex.length % 2 === 1) {
    hex = '0' + hex;
  }
  return hex;
}

export function hasModifier(node: ts.Node, ...kinds: Array<ts.Modifier['kind']>) {
  if (ts.canHaveModifiers(node)) {
    const modifiers = ts.getModifiers(node);

    if (typeof modifiers === 'undefined') {
      return false;
    }

    for (const modifier of modifiers) if (kinds.includes(modifier.kind)) return true;
  }

  return false;
}

export function isNumberLiteralExpr(expr: ts.Node | undefined) {
  if (expr === undefined) return false;

  if (ts.isNumericLiteral(expr) || ts.isBigIntLiteral(expr)) {
    return true;
  }
  return false;
}

export function alterFileExt(filename: string, toExt: string, fromExt?: string) {
  let originalExt = fromExt || extname(filename);
  if (!originalExt.startsWith('.')) {
    originalExt = '.' + originalExt;
  }
  const extReg = new RegExp(`${originalExt}$`);
  return filename.replace(extReg, '.' + toExt);
}

export function findReturnStatement(node: ts.Node): ts.Node | undefined {
  let res: ts.Node | undefined = undefined;

  function visit(node: ts.Node): void {
    if (res) {
      return;
    }

    if (ts.isReturnStatement(node)) {
      res = node;
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(node);
  return res;
}

export function findInsertCodeSeparatorStatement(node: ts.Node): ts.Node | undefined {
  let res: ts.Node | undefined = undefined;

  function visit(node: ts.Node): void {
    if (res) {
      return;
    }

    if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
      if (node.expression.getText() === 'this.insertCodeSeparator()') {
        res = node;
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(node);
  return res;
}

export function findBuildChangeOutputExpression(node: ts.Node): ts.Node | undefined {
  let res: ts.Node | undefined = undefined;

  function visit(node: ts.Node): void {
    if (res) {
      return;
    }

    if (ts.isPropertyAccessExpression(node)) {
      const expr = node as ts.PropertyAccessExpression;
      const name = expr.name.getText();
      if (name === 'buildChangeOutput') {
        res = expr;
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(node);
  return res;
}

export function allowByteStringLiteral(node: ts.Node) {
  if (ts.isCallExpression(node)) {
    if (
      isSubBytes(node.expression.getText()) ||
      node.expression.getText() == 'PubKeyHash' ||
      node.expression.getText() == 'Addr' ||
      node.expression.getText() === 'toByteString'
    ) {
      return true;
    }
  }
  return false;
}

export function checkByteStringLiteral(node: ts.StringLiteral): void {
  let text = node.getText();
  text = text.substring(1, text.length - 1); //remove ' or ";
  const parent: ts.CallExpression = node.parent as ts.CallExpression;
  const fn = parent.expression.getText();

  switch (fn) {
    case ScryptType.PUBKEY: {
      const pubkey = getValidatedHexString(text, true);
      if (pubkey.length > 0 && pubkey.length / 2 != 33) {
        throw new Error('invalid PubKey length, expect a ByteString with 33 bytes');
      }
      break;
    }
    case 'XOnlyPubKey': {
      const xpubkey = getValidatedHexString(text, true);
      if (xpubkey.length > 0 && xpubkey.length / 2 != 32) {
        throw new Error('invalid x-only PubKey length, expect a ByteString with 32 bytes');
      }
      break;
    }
    case 'Addr':
    case ScryptType.PubKeyHash:
    case ScryptType.RIPEMD160: {
      const pkh = getValidatedHexString(text, true);
      if (pkh.length > 0 && pkh.length / 2 != 20) {
        throw new Error(`invalid ${fn} length, expect a ByteString with 20 bytes`);
      }
      break;
    }
    case ScryptType.SHA1: {
      const sha1 = getValidatedHexString(text, true);
      if (sha1.length > 0 && sha1.length / 2 != 20) {
        throw new Error(`invalid ${fn} length, expect a ByteString with 20 bytes`);
      }
      break;
    }
    case ScryptType.SHA256: {
      const sha256 = getValidatedHexString(text, true);
      if (sha256.length > 0 && sha256.length / 2 != 32) {
        throw new Error(`invalid ${fn} length, expect a ByteString with 32 bytes`);
      }
      break;
    }
    case ScryptType.OPCODETYPE: {
      const sighash = getValidatedHexString(text, true);
      if (sighash.length / 2 != 1) {
        throw new Error(`invalid ${fn} length, expect a OpCodeType with 1 bytes`);
      }
      break;
    }
    case ScryptType.SIGHASHPREIMAGE: {
      getValidatedHexString(text, false);
      break;
    }
    case ScryptType.SIG:
      {
        const sig = getValidatedHexString(text, true);

        if (sig.length > 0 && ![71, 72, 73].includes(sig.length / 2)) {
          throw new Error(`invalid ${fn} length, expect a Sig with (71 || 72 || 73) bytes`);
        }
      }
      break;
    default:
      throw new Error(`invalid StringLiteral: ${fn}`);
  }
}

export function toBuiltinsTypes(t: string): string | undefined {
  switch (t) {
    case 'ByteString':
      return 'bytes';
    case 'Int32':
    case 'UInt32':
    case 'Int64':
    case 'UInt64':
      return 'int';
    case 'Bool':
      return ScryptType.BOOL;
    case 'Addr':
      return ScryptType.RIPEMD160;
    case 'PubKey':
      return ScryptType.PUBKEY;
    case 'XOnlyPubKey':
      return ScryptType.PUBKEY;
    case 'Sig':
      return ScryptType.SIG;
    case 'Ripemd160':
      return ScryptType.RIPEMD160;
    case 'PubKeyHash':
      return ScryptType.RIPEMD160;
    case 'Sha1':
      return ScryptType.SHA1;
    case 'Sha256':
      return ScryptType.SHA256;
    case 'SigHashType':
      return ScryptType.SIGHASHTYPE;
    // case 'ChangeInfo':
    //   return '__scrypt_ChangeInfo';
    // case 'InputStateProof':
    //   return '__scrypt_InputStateProof';
    // case 'StateUtils':
    //   return '__scrypt_StateUtils';
    // case 'Utils':
    //   return '__scrypt_Utils';
    // case 'SHPreimage':
    //   return '__scrypt_SHPreimage';
    // case 'Prevouts':
    //   return '__scrypt_PrevoutsCtx';
    case 'OpCodeType':
      return ScryptType.OPCODETYPE;
    default:
      return undefined;
  }
}

export function sha1(s: string): string {
  const sha1 = createHash('sha1');

  return sha1.update(s).digest('hex');
}

export function md5(s: string): string {
  const sha1 = createHash('md5');

  return sha1.update(s).digest('hex');
}

export function path2uri(path: string): string {
  return pathToFileURL(path).toString();
}

export function uri2path(uri: string): string {
  return fileURLToPath(uri);
}

export function filterUndefinedFields<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined),
  ) as Partial<T>;
}

export function findPackageDir(pkgName: string, baseFilePath: string) {
  const mainFile = resolvePathSync(pkgName, { url: baseFilePath });
  let dir = path.dirname(mainFile);
  while (true) {
    if (fs.existsSync(path.resolve(dir, 'package.json'))) {
      return dir;
    }
    const parentDir = path.resolve(dir, '..');
    if (parentDir === dir) {
      throw new Error(`Package root not found for ${pkgName}`);
    }
    dir = parentDir;
  }
}

export function toPosixPath(filePath: string): string {
  return filePath.replaceAll(path.sep, path.posix.sep);
}

export function arrayIncludes<T1, T2>(
  array: T1[],
  item: T2,
  equals: (a: T1, b: T2) => boolean,
): boolean {
  for (const element of array) {
    if (equals(element, item)) {
      return true;
    }
  }
  return false;
}

export async function readdirRecursive(dir: string): Promise<string[]> {
  const files = await readdir(dir, { withFileTypes: true });

  const paths = files.map(async (file) => {
    const p = path.join(dir, file.name);

    if (file.isDirectory()) return await readdirRecursive(p);

    return p;
  });

  return (await Promise.all(paths)).flat(1);
}

export function removeDuplicateFilter<T>(equals: (a: T, b: T) => boolean) {
  return function (item: T, index: number, self: T[]) {
    return index === self.findIndex((t) => equals(t, item));
  };
}
