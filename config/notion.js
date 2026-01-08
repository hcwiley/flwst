// config/example.notion.ts
export const notionConfig = {
  workspaceName: 'flwst',
  databases: {
    dailyNotes: {
      name: 'Daily Notes',
      /**
       * Database ID (from the page URL). Use this when fetching schema.
       */
      id: '282f192d808280adb6d9e7bad574276a',
      dataSourceId: '282f192d-8082-802e-8616-000b5fb096cd',
    },
    tasks: {
      name: 'TODO: Tasks',
      /**
       * Database ID (from the page URL). Use this when fetching schema.
       */
      id: '282f192d8082807dbf36ea237bfc48d2',
      /**
       * Optional: Data source (view) ID copied via “Copy data source ID”.
       * Needed only when creating pages via data_source_id.
       */
      dataSourceId: '282f192d-8082-80e3-bfae-000b72384079',
    },
  },
};
const printConfig = (config) => {
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'object' && value !== null) {
      printConfig(value);
    } else {
      console.log(`${key} => ${JSON.stringify(value, null, 2)}`);
    }
  }
};
console.log(`\n--------------------------------\n`);
console.log(`Notion config:`);
printConfig(notionConfig);
console.log(`\n--------------------------------\n`);
