import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  {
    // TEMPORARY: pre-redesign code only. Every path here is scheduled for a
    // rewrite on the acid design system (docs/REDESIGN.md phases 2-4). Remove
    // each entry as its file is rebuilt; delete the whole block at cleanup.
    // Do NOT add new files to this list.
    files: [
      "app/analytics/page.tsx",
      "app/api/v1/**",
      "app/dashboard/page.tsx",
      "app/leaderboard/page.tsx",
      "app/page.tsx",
      "app/payouts/page.tsx",
      "app/portfolio/page.tsx",
      "app/reputation/page.tsx",
      "app/settings/page.tsx",
      "app/t/**",
      "app/terminal/page.tsx",
      "app/trade/page.tsx",
      "app/traders/page.tsx",
      "app/vault/**",
      "components/*.tsx",
      "components/charts/**",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react/no-unescaped-entities": "warn",
      "prefer-const": "warn",
    },
  },
];

export default eslintConfig;
