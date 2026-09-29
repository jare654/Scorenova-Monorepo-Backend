(async () => {
  try {
    require("dotenv").config({ path: ".env" });

    const dataSourceModule = require("../dist/db/data-source.js");
    const seederModule = require("../dist/src/modules/question/seed/question.seed.js");

    const dataSource =
      dataSourceModule.default ||
      dataSourceModule.dataSource ||
      dataSourceModule;
    const seedQuestionData = seederModule.seedQuestionData;

    if (!dataSource || !seedQuestionData) {
      console.error(
        "Required modules not found in dist. Run `npm run build` first.",
      );
      process.exit(1);
    }

    console.log("Initializing datasource...");
    await dataSource.initialize();
    console.log("Datasource initialized. Running question seed...");

    await seedQuestionData(dataSource);

    console.log("Seeding complete. Closing datasource.");
    await dataSource.destroy();
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
})();
