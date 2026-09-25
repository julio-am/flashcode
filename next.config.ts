import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg-boss"],
  // Problems and the grader header are read from disk at runtime.
  outputFileTracingIncludes: {
    "/**": ["./problems/**/*", "./grader/flash.h"],
  },
};

export default nextConfig;
