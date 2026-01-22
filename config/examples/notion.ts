// config/example.notion.ts

export const notionConfig = {
  workspaceName: "flwst",
  databases: {
    dailyNotes: {
      name: "Daily Notes",
      /**
       * Database ID from the Notion page URL.
       */
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      /**
       * Optional data source/view ID (only required if you want to skip
       * fetching the database to look up its collections).
       */
      dataSourceId: "ffffffff-1111-2222-3333-444444444444",
    },
    tasks: {
      name: "TODO: Tasks",
      /**
       * Database ID from the Notion page URL.
       */
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      /**
       * Optional data source/view ID (only required if you want to skip
       * fetching the database to look up its collections).
       */
      dataSourceId: "ffffffff-1111-2222-3333-444444444444",
    },
  },
};

const printConfig = (config: any) => {
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "object" && value !== null) {
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
