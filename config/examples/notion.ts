// config/example.notion.ts

export const notionConfig = {
  workspaceName: "flwst",
  databases: {
    dailyNotes: {
      name: "Daily Notes",
      id: "optional but highly recommended",
    },
    tasks: {
      name: "TODO: Tasks",
      id: "optional but highly recommended",
    },
  },
};


const printConfig = (config: any) => {
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'object' && value !== null) {
      printConfig(value);
    } else {
      console.log(`${key} => ${JSON.stringify(value, null, 2)}`);
    }
  }
}

console.log(`\n--------------------------------\n`);
console.log(`Notion config:`);
printConfig(notionConfig);
console.log(`\n--------------------------------\n`);