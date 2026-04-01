"use client";

import { createContext, useContext } from "react";

export type AuthContextValue = {
  token: string;
  username: string;
};

export const AuthContext = createContext<AuthContextValue>({
  token: "",
  username: "",
});

export const useAuth = () => useContext(AuthContext);
