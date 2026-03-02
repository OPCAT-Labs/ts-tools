import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    ignores: [
      "node_modules/*",
      "dist/*",
      "out/*",
      "artifacts/*",
      "**/.env",
      "**/scrypt.index.json",
      ".vscode/*",
      "!.vscode/launch.json",
    ],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "prefer-rest-params": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  }
);
