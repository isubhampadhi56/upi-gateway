import "reflect-metadata";
import "dotenv/config";
import express from "express";
import routes from "./routes/index";

const app = express();
app.use(express.json());

// Serve OpenAPI docs only in development
if (process.env.NODE_ENV === "development") {
  import("swagger-ui-express").then((swaggerUi) => {
    import("./docs/openapi.json").then((spec) => {
      app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(spec));
    });
  });
}

app.use(routes);

export default app;
