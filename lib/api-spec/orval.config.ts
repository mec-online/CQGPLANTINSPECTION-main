import { defineConfig } from "orval";

export default defineConfig({
  api: {
    input: {
      target: "./openapi.yaml",
    },
    output: {
      mode: "tags-split",
      target: "../api-client-react/src/generated/api.ts",
      schemas: "../api-client-react/src/generated/api.schemas.ts",
      client: "react-query",
      override: {
        mutator: {
          path: "../api-client-react/src/custom-fetch.ts",
          name: "customFetch",
        },
        query: {
          useQuery: true,
          useSuspenseQuery: false,
        },
      },
    },
  },
  zod: {
    input: {
      target: "./openapi.yaml",
    },
    output: {
      mode: "single",
      target: "../api-zod/src/generated/api.ts",
      client: "zod",
    },
  },
});
