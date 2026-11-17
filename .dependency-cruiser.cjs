// Dependency rules for the code health checks (dependency-cruiser).
//
// ESLint checks functions, jscpd checks copies and knip checks dead code.
// None of them see how modules depend on each other. These rules do.
// Unused files and packages stay with knip, and broken imports with tsc.
//
// The layers come from docs/roadmap.md. Imports point inward only:
// routes/api -> ai -> domain -> infrastructure, and everything may use
// shared and config.
//
// The Stop hook runs these rules on src/. To accept the violations that
// exist now and block only new ones, run `npm run health:deps:baseline`.
// That writes .dependency-cruiser-known-violations.json.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "Modules that import each other are one unit split over files. " +
        "Move the shared part to its own module, or merge the modules.",
      from: {},
      to: { circular: true },
    },
    {
      name: "ai-not-to-api",
      severity: "error",
      comment:
        "src/ai coordinates model calls and must not depend on HTTP code. " +
        "Pass the data in from the route instead.",
      from: { path: "^src/ai/" },
      to: { path: "^src/(api|routes)/" },
    },
    {
      name: "domain-not-to-outer",
      severity: "error",
      comment:
        "src/domain holds the business rules. It must not depend on HTTP " +
        "code or on the AI layer, so the rules stay plain TypeScript that " +
        "a prompt cannot change.",
      from: { path: "^src/domain/" },
      to: { path: "^src/(api|routes|ai)/" },
    },
    {
      name: "infrastructure-not-to-outer",
      severity: "error",
      comment:
        "src/infrastructure (database, logging) must not depend on the " +
        "layers that use it.",
      from: { path: "^src/infrastructure/" },
      to: { path: "^src/(api|routes|ai|domain)/" },
    },
    {
      name: "shared-is-leaf",
      severity: "error",
      comment:
        "src/shared holds schemas and types that every layer uses. It must " +
        "not import from any other part of src.",
      from: { path: "^src/shared/" },
      to: { path: "^src/", pathNot: "^src/shared/" },
    },
    {
      name: "not-to-test",
      severity: "error",
      comment: "App code must not import test files or test helpers.",
      from: { pathNot: "\\.(test|spec)\\.[cm]?[jt]s$" },
      to: { path: "(\\.(test|spec)\\.[cm]?[jt]s$|^tests/)" },
    },
    {
      name: "not-to-dev-dep",
      severity: "error",
      comment:
        "App code must not import packages from devDependencies. They are " +
        "not installed in production. Move the package to dependencies.",
      from: {
        path: "^src/",
        pathNot: "\\.(test|spec)\\.[cm]?[jt]s$",
      },
      to: {
        dependencyTypes: ["npm-dev"],
        // Type-only imports are removed at build time.
        dependencyTypesNot: ["type-only"],
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    // Prisma writes this code. Its internal cycles are not ours to fix.
    exclude: { path: "^src/generated/" },
    // Type-only imports count for cycles: they still tie the modules together.
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".js", ".mjs", ".cjs", ".json"],
    },
  },
};
