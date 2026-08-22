module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "refactor", "perf", "style", "docs", "test", "chore"],
    ],
    "scope-enum": [
      2,
      "always",
      [
        "auth",
        "booking",
        "search",
        "payments",
        "profile",
        "messaging",
        "marketplace",
        "reviews",
        "admin",
        "model",
        "ui",
        "db",
        "i18n",
        "test",
      ],
    ],
  },
};
