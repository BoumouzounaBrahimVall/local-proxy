import { config } from "./config";
import { createApp } from "./app";

const app = createApp();

app.listen(config.port, () => {
  console.log("🚀 Local proxy running at:");
  console.log(`http://localhost:${config.port}${config.apiPrefix}`);
  console.log(`Proxying to: ${config.target}${config.apiPrefix}`);
});
