import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string;
      roleId?: number;
      modules?: string[];
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    roleId?: number;
    modules?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    roleId?: number;
    modules?: string[];
  }
}
