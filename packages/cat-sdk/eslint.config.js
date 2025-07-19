import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

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
    rules: {
      "prefer-rest-params": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  }
);
