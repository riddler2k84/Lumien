import client from "./client";

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: string;
  user_id: number;
  full_name: string;
}

export const login = (email: string, password: string) =>
  client.post<LoginResponse>("/auth/login", { email, password }).then((r) => r.data);

export const getDemoStatus = () =>
  client.get<{ mode: string; is_demo: boolean; currency: string; currency_symbol: string }>("/demo/status").then((r) => r.data);
