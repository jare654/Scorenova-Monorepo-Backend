(async () => {
  try {
    // Load environment
    require('dotenv').config({ path: '.env' });

    // Import compiled DataSource and seeder
    const dataSourceModule = require('../dist/db/data-source.js');
    const seederModule = require('../dist/src/helpers/curriculum.seeder.js');

    const dataSource = dataSourceModule.default || dataSourceModule.dataSource || dataSourceModule;
    const seedCurriculum = seederModule.seedCurriculum;

    if (!dataSource || !seedCurriculum) {
      console.error('Required modules not found in dist. Run `npm run build` first.');
      process.exit(1);
    }

    console.log('Initializing datasource...');
    await dataSource.initialize();
    console.log('Datasource initialized. Running curriculum seed...');

    await seedCurriculum(dataSource);

    console.log('Seeding complete. Closing datasource.');
    await dataSource.destroy();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
})();
