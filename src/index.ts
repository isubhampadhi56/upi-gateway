import { AppDataSource, intitializeDBData } from "./config/database";
import app from "./app";

const PORT = process.env.PORT || 3000;

async function main() {
  await AppDataSource.initialize();
  console.log("Database connected");
  await intitializeDBData();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
