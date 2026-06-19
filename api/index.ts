import { app } from "../src/index";

export default {
  fetch(request: Request) {
    return app.handle(request);
  }
};
