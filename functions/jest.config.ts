import type {Config} from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  setupFilesAfterEnv: [],
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json",
    },
  },
  watchman: false,
  cacheDirectory: ".jest-cache",
};

export default config;
